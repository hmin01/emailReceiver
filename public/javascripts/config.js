const imap = require('imap');

// imap 객체 선언
module.exports = {
    imap: function(typeUrl) {
        this.type = typeUrl;
        let mailReceiver;
        if(this.type === 'naver') {
            mailReceiver = new imap({
                user: 'n0_0mo_on@naver.com',
                password: 'hmin0101',
                host: 'imap.naver.com',
                port: 993,
                tls: true,
            });
        } else if(this.type === 'google') {
            mailReceiver = new imap({
                user: 'userName',
                password: 'password',
                host: 'imap.gmail.com',
                port: 993,
                tls: true,
            });
        } else if(this.type === 'kaist') {
            mailReceiver = new imap({
                user: 'userName',
                password: 'password',
                host: 'mail.kaist.ac.kr',
                port: 993,
                tls: true,
            });
        } else {
            return undefined;
        }
        return mailReceiver;
    }
};