const tls = require('tls');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/src',express.static('src'));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'src/index.html'));
});

app.post('/send-email', async (req, res) => {
    const { email, password, to, subject, text } = req.body;
    const emailData = { from: email, to, subject, body: text };

    try {
        const result = await sendmail(email, password, emailData);
        res.send(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to send email.');
    }
});

function sendmail(email, password, emailData) {
    return new Promise((resolve, reject) => {
        const smtpServer = 'smtp.gmail.com';
        const port = 465;

        const socket = tls.connect(port, smtpServer, { rejectUnauthorized: false }, () => {
            console.log('Connected to SMTP server');
            sendCommand(`EHLO localhost`);
        });

        socket.setEncoding('utf-8');

        let state = 0;

        socket.on('data', (data) => {
            console.log(`S: ${data.trim()}`);
            if (state === 0 && data.includes('250')) {
                state++;
                sendCommand('AUTH LOGIN');
            } else if (state === 1 && data.includes('334')) {
                state++;
                sendCommand(Buffer.from(email).toString('base64')); 
            } else if (state === 2 && data.includes('334')) {
                state++;
                sendCommand(Buffer.from(password).toString('base64')); 
            } else if (state === 3 && data.includes('235')) {
                state++;
                sendCommand(`MAIL FROM:<${emailData.from}>`);
            } else if (state === 4 && data.includes('250')) {
                state++;
                sendCommand(`RCPT TO:<${emailData.to}>`);
            } else if (state === 5 && data.includes('250')) {
                state++;
                sendCommand('DATA');
            } else if (state === 6 && data.includes('354')) {
                state++;
                sendCommand(`From: ${emailData.from}\r\nTo: ${emailData.to}\r\nSubject: ${emailData.subject}\r\n\r\n${emailData.body}\r\n.`);
            } else if (state === 7 && data.includes('250')) {
                sendCommand('QUIT');
                socket.end();
            }
        });

        socket.on('error', (err) => {
            reject(`Socket error: ${err.message}`);
        });

        socket.on('end', () => {
            console.log('Disconnected from SMTP server');
            resolve('Email sent successfully!');
        });

        function sendCommand(command) {
            console.log(`C: ${command}`);
            socket.write(command + '\r\n');
        }
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
