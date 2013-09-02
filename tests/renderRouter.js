var expect = require('expect.js'),
	renderRouter = require('../libs/renderRouter.js');

describe('RenderRouter',function() {
	it('picks correct paths',function() {
		
		var routes = { 
			'a/b//d': 0,
			'/x//z': 1,
			'g///j': 2,
			'///': 3
		};
		
		expect(renderRouter(routes,'1/x/2/z')).to.equal(1);
		expect(renderRouter(routes,'1/a/3/4')).to.equal(3);
		expect(renderRouter(routes,'g/h/i/j')).to.equal(2);
		expect(renderRouter(routes,'g/2/3/j')).to.equal(2);
		expect(renderRouter(routes,'g/2/3/4')).to.equal(3);
		expect(renderRouter(routes,'w/x/y/z')).to.equal(1);
		expect(renderRouter(routes,'1/2/3/j')).to.equal(3);
		expect(renderRouter(routes,'a/b/c/d')).to.equal(0);
		expect(renderRouter(routes,'a/b/3/d')).to.equal(0);
		
	});
});
