var middleware = requireMain("./middleware");
var socketio = requireMain("socket.io");
var cookie = requireMain("cookie");
var _ = requireMain("lodash");
var db = requireMain("./utils/database");

var clients = {};

var io = exports.io = null;

exports.start = function(server) {
	io = socketio(server);

	io.use(function(socket, next) {
		if(socket.request.headers.cookie)
			socket.request.cookies = cookie.parse(socket.request.headers.cookie);
		else
			socket.request.cookies = {};

		socket.request.ip = socket.handshake.address;

		next();
	});

	io.use(function(socket, next) {
		middleware.session(socket.request, null, next);
	});

	io.on("connection", function(socket) {
		if(socket.request.session.loggedin) {
			if( !clients[socket.request.session.userid] )
				clients[socket.request.session.userid] = clients[socket.request.session.username] = [];

			clients[socket.request.session.userid].push(socket);
		}

		socket.on("disconnect", function() {
			if( !socket.request.session.loggedin )
				return;

			if( !clients[socket.request.session.userid] )
				return;

			var index = clients[socket.request.session.userid].indexOf(socket);

			if(index > -1)
				clients[socket.request.session.userid].splice(index, 1);
		});
	});
}

exports.isActive = function isActive(id, session) {
	if(!clients[id] || !clients[id].length)
		return false;

	return _.some(clients[id], function(item) {
		return item.request.session.id === session;
	});
}

exports.emitAll = function emitAll(event, data) {
	io.emit(event, data);
}

exports.emitUser = function emitUser(id, event, data) {
	if(!clients[id])
		return;

	clients[id].forEach(function(client) {
		if(data)
			client.emit(event, data);
		else
			client.emit(event);
	});
}

exports.logoutUser = function logoutUser(id, session) {
	if(!clients[id])
		return;

	clients[id].forEach(function(client) {
		if(client.request.session.id !== session)
			return;
		
		client.emit("logout");
		client.disconnect();
	});
}