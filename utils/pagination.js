
module.exports = function(current, count, neighbours, frombegin, fromend) {
	
	neighbours = neighbours || 3;
	frombegin = frombegin || 1;
	fromend = fromend || 1;

	if(count < 2)
		return [];

	var pages = [1];

	if(count > 1)
		pages.push(count);

	if((current >= 1) && (current <= count)) {
		if((current > 1) && (current < count))
			pages.push(current);

		for(var i = current - neighbours; (i <= current + neighbours) && (i < count); i++) {
			if((i > 1) && pages.indexOf(i) == -1)
				pages.push(i);
		}
	}

	for(var i = 2; (i <= 1 + frombegin) && (i < count); i++) {
		if(pages.indexOf(i) == -1)
			pages.push(i);
	}

	for(var i = count - 1; (i >= count - fromend) && (i > 1); i--) {
		if(pages.indexOf(i) == -1)
			pages.push(i);
	}

	pages.sort();

	var result = [];

	result.push({
		page: "prev",
		active: false,
		enabled: current !== 1
	});

	pages.forEach(function(page, i) {
		result.push({
			page: page,
			active: page === current,
			enabled: true
		});

		if(pages[i+1] && (pages[i+1] !== page+1)) {
			result.push({
				page: "divider",
				active: false,
				enabled: false
			});
		}
	});

	result.push({
		page: "next",
		active: false,
		enabled: current !== count
	});

	return result;

}
