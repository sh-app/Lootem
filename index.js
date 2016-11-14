global.requireMain = function(name) {
	return require.main.require(name);
}

var express = requireMain("express");
var http = requireMain("http");
var bodyparser = requireMain("body-parser");
var validator = requireMain("express-validator");
var cookieparser = requireMain("cookie-parser");
var nunjucks = requireMain("nunjucks");
var config = requireMain("./config");
var database = requireMain("./utils/database");
var middleware = requireMain("./middleware");
var socket = requireMain("./socket");
var _ = requireMain("lodash");


var app = express();

/**
 * Setup
 */
app.set("env", config.env);

app.set("x-powered-by", false);

app.set("trust proxy", true);

nunjucks.configure('views', {
	autoescape: true,
	express: app,
	noCache: true
});

/**
 * Serving static files (CSS, JavaScript etc.)
 */
var staticOpt = {
	index: false,
	redirect: false
};

app.use(express.static("public", staticOpt));
app.use(express.static("node_modules/bootstrap/dist", staticOpt));
app.use("/js", express.static("node_modules/jquery/dist", staticOpt));
app.use("/js", express.static("node_modules/nunjucks/browser", staticOpt));
app.use("/css", express.static("node_modules/font-awesome/css", staticOpt));
app.use("/fonts", express.static("node_modules/font-awesome/fonts", staticOpt));
app.use("/metis", express.static("node_modules/metismenu/dist", staticOpt));
app.use("/css", express.static("node_modules/bootstrap-switch/dist/css/bootstrap3", staticOpt));
app.use("/js", express.static("node_modules/bootstrap-switch/dist/js", staticOpt));
app.use("/js/lodash.min.js", express.static("node_modules/lodash/lodash.min.js", staticOpt));

app.use(express.static("dependencies/public", staticOpt));

app.use("/views", express.static("views/public", staticOpt));
app.use("/views/admin", express.static("views/admin/public", staticOpt));

app.use(function(req, res, next) {
	res.onFinish = function(callback) {
		var onFinishCallback = function() {
			res.removeListener("finish", onFinishCallback);
			res.removeListener("close", onFinishCallback);
			callback();
		}
		res.on("finish", onFinishCallback);
		res.on("close", onFinishCallback);
	}
	next();
});

/**
 * Logging to console
 */
app.use(function(req, res, next) {
	res.onFinish(function() {
		var date = new Date();
		console.log("\033[34m" + _.padStart(date.getHours(),2,'0') + ":" + _.padStart(date.getMinutes(),2,'0') + ":" + _.padStart(date.getSeconds(),2,'0') + " \033[33m" + req.method + " " + req.originalUrl + ", " + req.ip + " -> " + res.statusCode + " " + res.statusMessage + "\033[0m");
	});

	next();
});

/**
 * Request parsers
 */
app.use(cookieparser());
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({
	extended: true
}));
app.use(validator());


/**
 * Middlewares
 */
app.use(middleware.session);
app.use(middleware.adminSession);
app.use(middleware.viewData);
app.use(requireMain("./middleware/flash"));


/**
 * Webiste logic
 */
app.use(requireMain("./controllers/home"));
app.use(requireMain("./controllers/login"));
app.use(requireMain("./controllers/profile"));
app.use(requireMain("./controllers/callbacks"));
app.use(requireMain("./controllers/admin"));


app.use(function(req, res) {
  res.status(404).send("<h1>Not found!</h1>");
});

if(app.get("env") == "production") {
	app.use(function(err, req, res, next) {
		console.log(err);
		res.status(500).send("<h1>Internal server error!</h1>");
	});
}


/**
 * Running the whole thing
 */
var server = http.Server(app);

socket.start(server);

server.listen(config.port, function() {
	console.log("Listening on port " + config.port);
});

