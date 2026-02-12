const http = require('http');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const ALLOWED_TYPES = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt', '.doc', '.docx'];
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/upload') {
        let body = [];
        let fileName = '';
        let fileData = Buffer.alloc(0);
        let boundary = '';

        const contentType = req.headers['content-type'];
        if (contentType && contentType.includes('multipart/form-data')) {
            boundary = '--' + contentType.split('boundary=')[1];
        }

        req.on('data', chunk => body.push(chunk));
        
        req.on('end', () => {
            const buffer = Buffer.concat(body);
            const parts = buffer.toString('binary').split(boundary);
            
            for (let part of parts) {
                if (part.includes('filename=')) {
                    const nameMatch = part.match(/filename="(.+?)"/);
                    if (nameMatch) {
                        fileName = nameMatch[1];
                        const ext = path.extname(fileName).toLowerCase();
                        
                        if (!ALLOWED_TYPES.includes(ext)) {
                            res.writeHead(400, { 'Content-Type': 'text/html' });
                            res.end('<h1>Error: File type not allowed</h1><a href="/">Go back</a>');
                            return;
                        }
                        
                        const dataStart = part.indexOf('\r\n\r\n') + 4;
                        const dataEnd = part.lastIndexOf('\r\n');
                        fileData = Buffer.from(part.substring(dataStart, dataEnd), 'binary');
                    }
                }
            }

            if (fileName && fileData.length > 0) {
                const filePath = path.join(UPLOAD_DIR, fileName);
                fs.writeFile(filePath, fileData, err => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'text/html' });
                        res.end('<h1>Error uploading file</h1><a href="/">Go back</a>');
                    } else {
                        res.writeHead(302, { 'Location': '/?success=true' });
                        res.end();
                    }
                });
            } else {
                res.writeHead(400, { 'Content-Type': 'text/html' });
                res.end('<h1>No file selected</h1><a href="/">Go back</a>');
            }
        });
    } else if (req.method === 'GET' && req.url === '/files') {
        fs.readdir(UPLOAD_DIR, (err, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Unable to read files' }));
            } else {
                const fileList = files.filter(f => f !== '.gitkeep');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(fileList));
            }
        });
    } else if (req.method === 'GET' && req.url.startsWith('/uploads/')) {
        const fileName = decodeURIComponent(req.url.replace('/uploads/', ''));
        const filePath = path.join(UPLOAD_DIR, fileName);
        
        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>File not found</h1>');
            } else {
                res.writeHead(200, { 'Content-Type': mime.lookup(filePath) || 'application/octet-stream' });
                res.end(content);
            }
        });
    } else {
        const url = req.url.split('?')[0];
        let filePath = path.join(__dirname, 'public', url === '/' ? 'index.html' : url);

        fs.readFile(filePath, (err, content) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end('<h1>404 - File Not Found</h1>', 'utf8');
                } else {
                    res.writeHead(500);
                    res.end(`Server Error: ${err.code}`);
                }
            } else {
                res.writeHead(200, { 'Content-Type': mime.lookup(filePath) });
                res.end(content, 'utf8');
            }
        });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));