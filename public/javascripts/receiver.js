const mailParser = require('mailparser').simpleParser;
const mail_limit = 7;
const iconv = require('iconv-lite');

module.exports = {
    update: function(mailReceiver, resolve, reject, preSize) {
        function openInbox(cb) {
            mailReceiver.openBox('INBOX', true, cb);        // 두번째 인자가 true이면 읽기전용, false이면 열린메일
        }
        mailReceiver.connect();
        mailReceiver.once('ready', function() {
           openInbox(function (err, box) {
               resolve(preSize !== box.messages.total);
           })
        });
        mailReceiver.once('error', function (err) {
            console.error(err);
            reject("connect error");
        });
        mailReceiver.once('end', function () {
            mailReceiver.end();
        });
    },
    attribute: function (mailReceiver, resolve, reject) {
        // imap 이메일 수신한 open
        function openInbox(cb) {
            mailReceiver.openBox("INBOX", true, cb);
        }

        mailReceiver.once('ready', function () {
            let attrList = [], cnt;
            openInbox(function (err, box) {
                if (err) throw err;
                const mail_totalCount =  box.messages.total;
                const offset = cnt = (mail_totalCount - mail_limit + 1);
                mailReceiver.search([[offset + ':*']], function (err, results) {   // UNSEEN : 읽지 않은 메일, SINCE : 지정된 날짜 이후 메시지
                    if (err) throw err;
                    const fetch = mailReceiver.fetch(results, {
                        bodies: '',
                        struct: true,
                    });

                    fetch.on('message', function (msg, seqno) {
                        msg.once('attributes', function (attrs) {
                            // charset 정보 추출
                            let charset_info = [];
                            if(attrs.struct[0].type === 'text' && attrs.struct[0].params.charset) {
                                charset_info.push(attrs.struct[0].params.charset);
                            } else {
                                for(let i=1;i<attrs.struct.length;i++) {
                                    if(attrs.struct[i][0].params.charset) {
                                        charset_info.push(attrs.struct[i][0].params.charset);
                                        break;
                                    }
                                }
                            }

                            // 읽음 여부 확인
                            let isRead = true;
                            if(attrs.flags.indexOf('\\Seen') === -1)
                                isRead = false;
                            attrList.unshift({uid: attrs.uid, isRead: isRead, charset:charset_info});
                            if(cnt === mail_totalCount) {
                                resolve(attrList);
                            }
                            cnt++;
                        });
                    });
                    fetch.once('error', function (err) {
                        console.error('Fetch error: ' + err);
                    });
                });
            });
        });
        mailReceiver.once('error', function (err) {
            console.error(err);
            reject("connect error");
        });
        mailReceiver.once('end', function () {
            mailReceiver.end();
        });
        // 연결
        mailReceiver.connect();
    },
    connect: function (mailReceiver, resolve, reject, attrList) {
        // imap 이메일 수신한 open
        function openInbox(cb) {
            mailReceiver.openBox("INBOX", true, cb);
        }

        mailReceiver.once('ready', function () {
            let dataList = [], currentItemNum, n = 0;
            openInbox(function (err, box) {
                if (err) throw err;
                const mail_totalCount =  box.messages.total;
                const offset = currentItemNum = (mail_totalCount - mail_limit + 1);
                mailReceiver.search([[offset + ':*']], function (err, results) {   // UNSEEN : 읽지 않은 메일, SINCE : 지정된 날짜 이후 메시지
                    if (err) throw err;
                    const fetch = mailReceiver.fetch(results, {
                        bodies: '',
                        struct: true,
                    });

                    fetch.on('message', function (msg, seqno) {
                        msg.on('body', function (stream) {
                            let buffer = '';
                            const charset = attrList[(mail_limit - 1) - n].charset.toString();
                            if(charset === 'utf-8' || charset === 'UTF-8' || charset === 'euc-kr' || charset === undefined) {
                                let decodeStream = iconv.decodeStream('euc-kr');
                                stream.pipe(decodeStream);

                                let chunks = [];
                                let chunklen = 0;
                                decodeStream.on('readable', () => {
                                    let chunk;
                                    while ((chunk = decodeStream.read()) !== null) {
                                        if (typeof chunk === 'string') {
                                            chunk = Buffer.from(chunk);
                                        }
                                        chunks.push(chunk);
                                        chunklen += chunk.length;
                                    }
                                });

                                decodeStream.once('end', () => {
                                    new Promise(function (resolve) {
                                        let decodingText = Buffer.concat(chunks, chunklen)
                                            .toString()
                                            .replace(/\r?\n/g, '\n');
                                        resolve(decodingText);
                                    })
                                        .then(function(decodingText) {
                                            parsing(seqno, decodingText, false);
                                        })
                                        .catch(function(){});
                                });
                            } else {
                                // 데이터 청크를 전송할 때, 발생
                                stream.on('data', function (chunk) {
                                    buffer += chunk;
                                });

                                // 소비할 데이터가 없으면 호출
                                stream.once('end', function () {
                                    parsing(seqno, buffer, true);
                                });
                            }
                            n++;
                        });
                        msg.once('end', function () {});
                    });
                    fetch.once('error', function (err) {
                        console.error('Fetch error: ' + err);
                    });
                });

                function parsing(seqno, body, decode) {
                    mailParser(body, decode)
                        .then(function (mail) {
                            const data = {
                                no: seqno,
                                subject: mail.subject,
                                from: mail.from.value[0].name,
                                date: mail.date,
                                body: mail.html,
                                attachments: mail.attachments,
                            };
                            dataList.unshift(data);
                            finish();
                            currentItemNum++;
                        })
                        .catch(function (err) {
                            console.error(err);
                        });
                }

                function finish() {
                    if (currentItemNum === mail_totalCount) {
                        dataList.sort(function (a, b) {
                            return a.no < b.no ? 1 : a.no > b.no ? -1 : 0;
                        });

                        const mail_data = {
                            data: dataList,
                            totalSize: mail_totalCount
                        };

                        for(let i=0;i<mail_data.data.length;i++) {
                            mail_data.data[i].attr = attrList[i];
                        }
                        resolve(mail_data);
                    }
                }
            });
        });
        mailReceiver.once('error', function (err) {
            console.error(err);
            reject("connect error");
        });
        mailReceiver.once('end', function () {
            mailReceiver.end();
        });
        // 연결
        mailReceiver.connect();
    },
    seen: function(mailReceiver, email_data) {
        function openInbox(cb) {
            mailReceiver.openBox("INBOX", false, cb);
        }

        mailReceiver.connect();

        mailReceiver.once('ready', function () {
            openInbox(function (err, box) {
                if (err) throw err;
                mailReceiver.addFlags(email_data.attr.uid, '\\Seen', function(err) {
                    if(err) {
                        console.error(err);
                    } else {
                        email_data.attr.isRead = true;
                    }
                });
            });
        });
        mailReceiver.once('error', function (err) {
            console.error(err);
        });
        mailReceiver.once('end', function () {
            mailReceiver.end();
        });
    }
};