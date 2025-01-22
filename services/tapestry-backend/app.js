var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
const cors = require("cors");
var logger = require("morgan");
require("dotenv").config();
const fileUpload = require("express-fileupload");
const { EventEmitter } = require('events');
const http = require('http');
const socketIO = require('socket.io');
// let botApis = require("./botApis");
const envVars = require("./helper/config");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger.json");
EventEmitter.defaultMaxListeners = 100;
const cron = require('node-cron');
const cronJobs = require("./cron")
var app = express();
const port = envVars.TAPESTRY_BACKEND_PORT || 8956; // Fallback to 8956 if PORT is not set
const logger1 = require('./logger');


// Initialize HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = socketIO(server,
  {
    cors: {
      origin: '*',
    },
  }
);
global.io = io;
app.use(cors());

// Middleware
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(fileUpload());

const router = require("./routes/adminRoutes");
app.use("/admin", router);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Socket.io
require('./socket')(io);


app.use(express.static(path.join(__dirname, "public")));


app.use((req, res, next) => {
  if (/(.ico|.js|.css|.jpg|.png|.map)$/i.test(req.path)) {
    next()
  } else {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
  }
})

// Error handling
app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  logger1.error(error);
  res.json({ error: err.message }); // Send error as JSON
});

// Start server
server.listen(port, () => {
  logger1.info(`Server running on http://0.0.0.0:${port}`);
});
cron.schedule('* * * * *', () => {
  logger1.info('Running scheduled tasks...');
  cronJobs.scheduleBroadcasts()
});
cron.schedule('*/30 * * * * *', () => {
  logger1.info('Running emails reply...');
  cronJobs.replyEmails()
});
// botApis.botFun();

module.exports = app;
