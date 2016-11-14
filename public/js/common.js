$(".tooltipped").tooltip();

nunjucks.configure("/views", {
	autoescape: true,
	noCache: true
});

$.fn.flashText = function() {
	var self = this;
	self.addClass("text-animated flash-text");
	setTimeout(function() {
		self.removeClass("flash-text");
	}, 500);
}

$.fn.flashBackground = function() {
	var self = this;
	self.addClass("bg-animated flash-bg");
	setTimeout(function() {
		self.removeClass("flash-bg");
	}, 500);
}