const express = require('express');
const router = express.Router();
const mime = require('mime-types');
const Readable = require('stream').Readable;
const path = require('path');

const fm = require('../public/javascripts/fileManager').manage;
const receiver = require('../public/javascripts/receiver');
const config = require('../public/javascripts/config');
const calendar = require('../calendar');

function EmailObj() { this.size = 0 }
const naver_email = new EmailObj();
const google_email = new EmailObj();
const kaist_email = new EmailObj();

let config_naver_imap, config_google_imap, config_kaist_imap;
let schedule;

/* GET home page. */
router.get('/', function(req, res) {
    new Promise(function(resolve, reject) {
        getUserData(req, resolve, reject);
    })
        .then(function() {
            return new Promise(function(resolve, reject) {
                calendar(resolve, reject);
            });
        })
        .then(function(list) {
            schedule = list;
            res.render('mail_inbox');
        })
        .catch(function(err) {
            console.error(err);
        });
});

router.get('/schedule', function(req, res) {
    res.json({schedule: schedule});
});

router.get('/naverEmail', function (req, res) {
    let isUpdate = false;
    if(req.session.naver_id !== undefined) {
        config_naver_imap = config.imap("naver");
        config_naver_imap._config.user = req.session.naver_id;
        config_naver_imap._config.password = req.session.naver_pw;

        new Promise(function(resolve, reject) {
            receiver.update(config_naver_imap, resolve, reject, naver_email.size);
        })
            .then(function(result) {
                if(isUpdate = result) {
                    return new Promise(function (resolve, reject) {
                        receiver.connect(config_naver_imap, resolve, reject);
                    });
                }
            })
            .then(function(mail_data) {
                if(isUpdate) {
                    naver_email.data = mail_data.data;
                    naver_email.size = mail_data.totalSize;
                }
                res.json({list: naver_email.data});
            })
            .catch(function(err) {
                console.error(err);
            });
    } else {
        console.log('no data!! (naver account)');
    }
});

router.get('/googleEmail', function (req, res) {
    let isUpdate = false;
    if(req.session.google_id !== undefined) {
        config_google_imap = config.imap("google");
        config_google_imap._config.user = req.session.google_id;
        config_google_imap._config.password = req.session.google_pw;

        new Promise(function (resolve, reject) {
            receiver.update(config_google_imap, resolve, reject, google_email.size);
        })
            .then(function (result) {
                if (isUpdate = result) {
                    return new Promise(function (resolve, reject) {
                        config_google_imap = config.imap("google");
                        config_google_imap._config.user = req.session.google_id;
                        config_google_imap._config.password = req.session.google_pw;
                        receiver.connect(config_google_imap, resolve, reject);
                    });
                }
            })
            .then(function (mail_data) {
                if (isUpdate) {
                    google_email.data = mail_data.data;
                    google_email.size = mail_data.totalSize;
                }
                res.json({list: google_email.data});
            })
            .catch(function (err) {
                console.error(err);
            });
    } else {
        console.log('no data!! (google account)');
    }
});

router.get('/kaistEmail', function (req, res) {
    let isUpdate = false;
    if(req.session.kaist_id !== undefined) {
        config_kaist_imap = config.imap("kaist");
        config_kaist_imap._config.user = req.session.kaist_id;
        config_kaist_imap._config.password = req.session.kaist_pw;

        new Promise(function(resolve, reject) {
            receiver.update(config_kaist_imap, resolve, reject, kaist_email.size);
        })
            .then(function(result) {
                if(isUpdate = result) {
                    return new Promise(function(resolve, reject) {
                        receiver.connect(config_kaist_imap, resolve, reject);
                    });
                }
            })
            .then(function(mail_data) {
                if(isUpdate) {
                    kaist_email.data = mail_data.data;
                    kaist_email.size = mail_data.totalSize;
                }
                res.json({list: kaist_email.data});
            })
            .catch(function(err) {
                console.error(err);
            });
    } else {
        console.log('no data!! (kaist account)');
    }
});

router.get('/detail', function(req, res) {
    res.render('mail_detail');
});

router.get('/detail/naverEmail/:num', function(req, res) {
    res.render('mail_detail', {type: "naver", no: req.params.num});
});

router.get('/detail/googleEmail/:num', function(req, res) {
    res.render('mail_detail', {type: "google", no: req.params.num});
});

router.get('/detail/kaistEmail/:num', function(req, res) {
    res.render('mail_detail', {type: "kaist", no: req.params.num});
});

router.get('/getContent/:typeUrl/:select', function(req, res) {
    const typeUrl = req.params.typeUrl;
    const select = req.params.select;
    let imap, email_data;
    if(typeUrl === 'naver') {
        email_data = naver_email.data[select];
        imap = config_naver_imap;
    } else if(typeUrl === 'google') {
        email_data = google_email.data[select];
        imap = config_google_imap;
    } else if(typeUrl === 'kaist') {
        email_data = kaist_email.data[select];
        imap = config_kaist_imap;
    }
    // 읽음 처리
    receiver.seen(imap, email_data);

    const attachments_info = {
        cnt: email_data.attachments.length,
        files: [],
    };

    if(attachments_info.cnt < 1) {
        res.json({subject: email_data.subject, body: email_data.body, isAttach: 0});
    } else {
        for(let i=0; i<attachments_info.cnt; i++) {
            attachments_info.files.push({fileName: email_data.attachments[i].filename, size: email_data.attachments[i].size});
        }
        res.json({subject: email_data.subject, body: email_data.body, attachments: attachments_info});
    }
});

router.get('/download/:typeUrl/:no/:attachment_id', function(req, res) {
    const typeUrl = req.params.typeUrl;
    const no = req.params.no;
    let attachments;
    if(typeUrl === 'naver') {
        attachments = naver_email.data[no].attachments;
    } else if(typeUrl === 'google') {
        attachments = google_email.data[no].attachments;
    } else if(typeUrl === 'kaist') {
        attachments = kaist_email.data[no].attachments;
    }

    // 첨부파일 정보
    const attachment = attachments[req.params.attachment_id];

    // res에 Mime 정보 추가
    const mimetype = mime.lookup(attachment.filename);
    res.attachment(attachment.filename);
    res.set('Content-type', mimetype);
    res.set('Content-length', attachment.size);

    // attachment buffer를 readableStream을 만들어 pipe메서드로 저장
    const inStream = new Readable({});
    inStream.push(attachment.content);
    inStream.push(null);
    inStream.pipe(res);
});

function getUserData(req, resolve, reject) {
    fm.fileExist(path.join(__dirname, '..', '/user.txt'), function (exist) {
        if(exist) {
            fm.read(path.join(__dirname, '..', '/user.txt'), function(err, result) {
                if(err) {
                    reject(err);
                } else {
                    for(let i=0; i<result.length;i++) {
                        const split = result[i].split('/');
                        if(split[0] === 'naver') {
                            req.session.naver_id=split[1];
                            req.session.naver_pw=split[2];
                        } else if(split[0] === 'google') {
                            req.session.google_id=split[1];
                            req.session.google_pw=split[2];
                        } else if(split[0] === 'kaist') {
                            req.session.kaist_id=split[1];
                            req.session.kaist_pw=split[2];
                        }
                    }
                    resolve();
                }
            });
        }
    });
}

module.exports = router;
