const mailParser = require('mailparse').simpleParser;
const mail_limit = 7;

module.exports = {
    update: function(mailReceiver, resolve, reject, preSize) {
        function openInbox(cb) {
            mailReceiver.openBox('INBOX', true, cb);
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
    },
    connect: function (mailReceiver, resolve, reject) {
        // imap 이메일 수신한 open
        function openInbox(cb) {
            mailReceiver.openBox("INBOX", true, cb);
        }

        mailReceiver.once('ready', function () {
            let dataList = new Array(), cnt;
            openInbox(function (err, box) {
                if (err) throw err;
                const mail_totalCount =  box.messages.total;
                const offset = cnt = (mail_totalCount - mail_limit);
                mailReceiver.search([[offset + ':*']], function (err, results) {   // UNSEEN : 읽지 않은 메일, SINCE : 지정된 날짜 이후 메시지
                    if (err) throw err;
                    const fetch = mailReceiver.fetch(results, {
                        bodies: '',
                        struct: true,
                    });

                    fetch.on('message', function (msg, seqno) {
                        msg.on('body', function (stream, info) {
                            let buffer = '';
                            // 데이터 청크를 전송할 때, 발생
                            stream.on('data', function (chunk) {
                                buffer += chunk.toString();
                            });

                            // 소비할 데이터가 없으면 호출
                            stream.once('end', function () {
                                mailParser(buffer)
                                    .then(function (mail) {
                                        const data = {
                                            uid: seqno,
                                            subject: mail.subject,
                                            from: mail.from.value[0].name,
                                            date: mail.date,
                                            body: mail.html,
                                            attachments: mail.attachments,
                                        };
                                        // push()은 맨 끝에, unshift()는 맨 앞에 추가
                                        dataList.unshift(data);
                                        cnt++;

                                        if (cnt - 1 === mail_totalCount) {
                                            // uid기준 내림차순 정렬
                                            dataList.sort(function(a, b) {
                                                return a.uid < b.uid ? 1 : a.uid > b.uid ? -1 : 0;
                                            });

                                            const mail_data = {
                                                data: dataList,
                                                totalSize: mail_totalCount
                                            };
                                            resolve(mail_data);
                                        }
                                    })
                                    .catch(function (err) {
                                        console.error(err);
                                    });
                            });
                        });
                        msg.once('attributes', function (attrs) {
                            // console.log('Attributes: %s', inspect(attrs, false, 8));
                        });
                        msg.once('end', function () {
                        });
                    });
                    fetch.once('error', function (err) {
                        console.error('Fetch error: ' + err);
                    });
                    fetch.once('end', function () {
                        // console.log('Done fetching all messages!');
                        mailReceiver.end();
                    });
                });
            });
        });
        mailReceiver.once('error', function (err) {
            console.error(err);
            reject("connect error");
        });
        mailReceiver.once('end', function () {
            console.log('Connection ended');
        });
        // 연결
        mailReceiver.connect();
    }
};