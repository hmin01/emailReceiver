const express = require('express');
const router = express.Router();
const mime = require('mime-types');
const Readable = require('stream').Readable;
const path = require('path');
const fm = require('../public/javascripts/fileManager').manage;

const receiver = require('../public/javascripts/receiver');
const config = require('../public/javascripts/config');

function EmailObj() { this.size = 0 }
const naver_email = new EmailObj();
const google_email = new EmailObj();
const kaist_email = new EmailObj();

/* GET home page. */
router.get('/', function(req, res) {
    new Promise(function(resolve, reject) {
        getUserData(req, resolve, reject);
    })
        .then(function() {
            console.log(req.session);
            res.render('mail_inbox');
        })
        .catch(function(err) {
            console.error(err);
        });
});

router.get('/naverEmail', function (req, res) {
    let isUpdate = false;
    if(req.session.naver_id !== undefined) {
        const imap = config.imap("naver");
        imap._config.user = req.session.naver_id;
        imap._config.password = req.session.naver_pw;

        new Promise(function(resolve, reject) {
            receiver.update(imap, resolve, reject, naver_email.size);
        })
            .then(function(result) {
                if(isUpdate = result) {
                    return new Promise(function (resolve, reject) {
                        receiver.connect(imap, resolve, reject);
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
        console.log('no data!! (naver account)')
    }
});

router.get('/googleEmail', function (req, res) {
    let isUpdate = false;
    if(req.session.naver_id !== undefined) {
        new Promise(function (resolve, reject) {
            const imap = config.imap("google");
            imap._config.user = req.session.google_id;
            imap._config.password = req.session.google_pw;
            receiver.update(imap, resolve, reject, google_email.size);
        })
            .then(function (result) {
                if (isUpdate = result) {
                    return new Promise(function (resolve, reject) {
                        const imap = config.imap("google");
                        imap._config.user = req.session.google_id;
                        imap._config.password = req.session.google_pw;
                        receiver.connect(imap, resolve, reject);
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
        console.log('no data!! (google account)')
    }
});

router.get('/kaistEmail', function (req, res) {
    let isUpdate = false;
    if(req.session.naver_id !== undefined) {
        const imap = config.imap("kaist");
        imap._config.user = req.session.kaist_id;
        imap._config.password = req.session.kaist_pw;

        new Promise(function(resolve, reject) {
            receiver.update(imap, resolve, reject, kaist_email.size);
        })
            .then(function(result) {
                if(isUpdate = result) {
                    return new Promise(function(resolve, reject) {
                        receiver.connect(imap, resolve, reject);
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
        console.log('no data!! (kaist account)')
    }
});

router.get('/detail', function(req, res) {
    res.render('mail_detail');
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

router.get('/getContent/:typeUrl/:select', function(req, res) {
    const typeUrl = req.params.typeUrl;
    const select = req.params.select;
    let subject, body, attachments;
    if(typeUrl === 'naver') {
        subject = naver_email.data[select].subject;
        body = naver_email.data[select].body;
        attachments = naver_email.data[select].attachments;
    } else if(typeUrl === 'google') {
        subject = google_email.data[select].subject;
        body = google_email.data[select].body;
        attachments = google_email.data[select].attachments;
    } else if(typeUrl === 'kaist') {
        subject = kaist_email.data[select].subject;
        body = kaist_email.data[select].body;
        attachments = kaist_email.data[select].attachments;
    }

    const attachments_info = {
        cnt: attachments.length,
        files: [],
    };
    if(attachments.length < 1) {
        res.json({subject: subject, body: body, isAttach: 0});
    } else {
        for(let i=0; i<attachments.length; i++) {
            attachments_info.files.push({fileName: attachments[i].filename, size: attachments[i].size});
        }
        res.json({subject: subject, body: body, attachments: attachments_info});
    }
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
