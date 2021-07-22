const createError = require('http-errors');
const express = require('express');
const path = require('path');
const localtunnel = require('localtunnel');
const HlsStream = require('./scripts/hls-stream');

let tunnel, hls;

const app = express();

function requireAuthentication(req, res, next) {
  // -----------------------------------------------------------------------
  // authentication middleware

  const auth = {login: 'user', password: 'password'}

  // parse login and password from headers
  const b64auth = (req.headers.authorization || '').split(' ')[1] || ''
  const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':')

  // Verify login and password are set and correct
  if (login && password && login === auth.login && password === auth.password) {
    // Access granted...
    return next()
  }

  // Access denied...
  res.set('WWW-Authenticate', 'Basic realm="401"') 
  res.status(401).send('Authentication required.')

  // -----------------------------------------------------------------------
}

app.use('/static', requireAuthentication, express.static(path.join(__dirname, 'public')));

app.use('/stream', requireAuthentication, express.static(path.join(__dirname, 'public/video')));

app.use('/close', requireAuthentication, async function (req, res, next) {
  await endStream();
  res.send("Closing stream");
});

app.use('/start', requireAuthentication, async function (req, res, next) {
  await startStream();
  res.send("Starting stream");
});

app.get('*', requireAuthentication, function (req, res, next) {
  res.send("Testing");
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

const server = app.listen(3000, function () {
  console.log('Server listening on port 3000');
});

async function startStream(){
  hls = new HlsStream();
  hls.startVideo();
  
  tunnel = await localtunnel({ port: 3000 });

  tunnel.url;  
  console.log('HTTP tunneled');
  console.log(tunnel.url);
  tunnel.on('close', () => {
    // tunnels are closed
    console.log('closing stream');
  });
};

startStream();

async function endStream() {
  tunnel.close();
  hls.stopVideo();
}

