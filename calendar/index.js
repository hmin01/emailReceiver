const fs = require('fs');
const readline = require('readline');
const google = require('googleapis');
const moment = require('moment');
const http = require('http');

module.exports = function(resolve, reject, authCode) {
    const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

    // const TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) + '/.credentials';
    const TOKEN_PATH = 'token.json';

    // read google api config file (구글 api키에서 따로 다운받아야 함)
    fs.readFile('credentials.json', function (err, content) {
        if (err) {
            return console.error('Error loading client secret file : ' + err);
        }
        authorize(JSON.parse(content), listEvents);
    });

    function authorize(credentials, callback) {
        // credentials.json 파일에서 시크릿키, 클라이언트 아이디, 리다이렉트 url을 받아옴
        const { client_secret, client_id, redirect_uris } = credentials.installed;
        const oAuth2Client = new google.google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

        fs.readFile(TOKEN_PATH, function (err, token) {
            // 앞서 지정한 디렉토리와 파일명으로 토큰 파일을 read
            if (err) {       // 토큰이 없으면 생성
                return getNewToken(oAuth2Client, callback);
            } else {        // 있으면 객체에 저장
                console.log('exist');
                oAuth2Client.credentials = JSON.parse(token);
                callback(oAuth2Client);
            }
        });
    }

    function getNewToken(oAuth2Client, callback) {
        // Url로 이동하여 사용자 인증 후, code를 받아 와야 함
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });
        console.log('Authorize this app by visiting this url: ', authUrl);

        // code를 받아와 토큰을 생성
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        (function (code) {
            rl.close();
            oAuth2Client.getToken(code, function(err, token) {
                if (err) return reject(authUrl);
                oAuth2Client.setCredentials(token);
                fs.writeFile(TOKEN_PATH, JSON.stringify(token), function(err) {
                    if (err) console.error(err);
                    console.log('Token stored to', TOKEN_PATH);
                });
                callback(oAuth2Client);
            });
        })(authCode);
    }

    function listEvents(auth) {
        const startWeek = moment().startOf('week').add(1, 'day');
        const endWeek = moment().startOf('week').add(7, 'day');
        const calendar = google.google.calendar({version: 'v3', auth});
        calendar.events.list({
            calendarId: '32bm7o5dmf8u03nbfn2353v1pk@group.calendar.google.com',     // 사용할 캘린더 ID
            timeMin: startWeek.toISOString(),
            timeMax: endWeek.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        }, function (err, res) {
            if (err) return console.log('The API returned an error: ' + err);
            const events = res.data.items;
            const eventList = [];
            if (events.length) {
                events.map(function(event) {
                    const date = event.start.dateTime || event.start.date;
                    eventList.push({date: date, content: event.summary});
                });
            } else {
                console.error("No upcoming events found.");
            }
            resolve(eventList);
        });
    }
};