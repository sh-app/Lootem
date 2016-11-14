var socket = io.connect(document.location.origin);

socket.on("reconnect", function() {
	socket.io.disconnect();
	socket.io.connect();
});

socket.on("logout", function() {
	window.location.reload();
});