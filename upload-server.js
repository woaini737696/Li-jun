const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8899;
const SAVE_PATH = '/workspace/xiaoqin/public/logo.png';

const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>上传 Logo 图片</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; background: #eff6ff; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(37,99,235,0.15); padding: 40px; max-width: 420px; width: 90%; text-align: center; }
  h1 { color: #2563eb; font-size: 20px; margin-bottom: 8px; }
  p { color: #64748b; font-size: 13px; margin-bottom: 24px; }
  .drop-zone { border: 2px dashed #93c5fd; border-radius: 12px; padding: 40px 20px; cursor: pointer; transition: all 0.2s; }
  .drop-zone:hover { border-color: #2563eb; background: #eff6ff; }
  .drop-zone.has-file { border-color: #22c55e; background: #f0fdf4; }
  input[type=file] { display: none; }
  .preview { max-width: 120px; max-height: 120px; border-radius: 12px; margin: 16px auto; display: none; }
  .preview.show { display: block; }
  button { margin-top: 20px; padding: 12px 32px; border-radius: 10px; border: none; background: #2563eb; color: white; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  button:hover { background: #1d4ed8; transform: translateY(-1px); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .msg { margin-top: 16px; padding: 10px; border-radius: 8px; font-size: 13px; display: none; }
  .msg.ok { background: #f0fdf4; color: #16a34a; display: block; }
  .msg.err { background: #fef2f2; color: #dc2626; display: block; }
</style>
</head>
<body>
  <div class="card">
    <h1>上传 Logo 图片</h1>
    <p>选择你的猫图片，将自动设为系统 Logo</p>
    <div class="drop-zone" id="dropZone" onclick="document.getElementById('fileInput').click()">
      <div id="dropText">点击选择图片<br><small style="color:#94a3b8">支持 PNG / JPG / WebP</small></div>
      <img class="preview" id="preview" />
    </div>
    <input type="file" id="fileInput" accept="image/png,image/jpeg,image/webp" />
    <button id="uploadBtn" disabled onclick="upload()">上传并设为 Logo</button>
    <div class="msg" id="msg"></div>
  </div>
<script>
  let selectedFile = null;
  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');
  const preview = document.getElementById('preview');
  const dropText = document.getElementById('dropText');
  const uploadBtn = document.getElementById('uploadBtn');
  const msg = document.getElementById('msg');

  fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showMsg('请选择图片文件', 'err'); return; }
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = function(ev) { preview.src = ev.target.result; preview.classList.add('show'); };
    reader.readAsDataURL(file);
    dropZone.classList.add('has-file');
    dropText.innerHTML = '已选择: ' + file.name + '<br><small style="color:#22c55e">点击可重新选择</small>';
    uploadBtn.disabled = false;
    msg.className = 'msg';
  });

  function upload() {
    if (!selectedFile) return;
    uploadBtn.disabled = true;
    uploadBtn.textContent = '上传中...';
    const formData = new FormData();
    formData.append('file', selectedFile);
    fetch('/upload', { method: 'POST', body: formData })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          showMsg('上传成功！Logo 已保存，请关闭此页面并告知助手。', 'ok');
          uploadBtn.textContent = '上传成功';
        } else {
          showMsg(data.error || '上传失败', 'err');
          uploadBtn.disabled = false;
          uploadBtn.textContent = '上传并设为 Logo';
        }
      })
      .catch(err => {
        showMsg('上传失败: ' + err.message, 'err');
        uploadBtn.disabled = false;
        uploadBtn.textContent = '上传并设为 Logo';
      });
  }

  function showMsg(text, type) {
    msg.textContent = text;
    msg.className = 'msg ' + type;
  }
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
    return;
  }

  if (req.method === 'POST' && req.url === '/upload') {
    const boundary = req.headers['content-type']?.split('boundary=')[1];
    if (!boundary) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: '无效的请求' }));
      return;
    }

    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const body = buffer.toString('binary');
      // 提取文件内容
      const parts = body.split('--' + boundary);
      for (const part of parts) {
        if (part.includes('Content-Disposition') && part.includes('filename')) {
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd === -1) continue;
          const fileContent = part.substring(headerEnd + 4, part.length - 2);
          const fileBuffer = Buffer.from(fileContent, 'binary');
          // 保存为 PNG（或保留原始格式）
          const ext = part.match(/filename="[^"]*\.(\w+)"/);
          const savePath = ext && ext[1] !== 'png' 
            ? '/workspace/xiaoqin/public/logo.' + ext[1].toLowerCase()
            : SAVE_PATH;
          // 如果不是 png，也要保存一份 png 引用
          try {
            fs.writeFileSync(savePath, fileBuffer);
            // 同时保存一份 logo.png 用于兼容
            if (savePath !== SAVE_PATH) {
              fs.writeFileSync(SAVE_PATH, fileBuffer);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, path: savePath }));
            console.log('Logo uploaded to:', savePath, 'size:', fileBuffer.length);
            return;
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: e.message }));
            return;
          }
        }
      }
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: '未找到文件' }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Upload server running at http://localhost:' + PORT);
});
