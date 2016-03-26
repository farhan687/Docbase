$(document).ready(function() {
	hljs.initHighlightingOnLoad();
	new WOW().init();
	//Resize
	function resize() {
		var height = $(window).height();
		$('header').css('min-height',height);
		var videoWidth = $('iframe').width();
		var videoHeight = videoWidth*(3/4);
		var subheading = $('.codeContainer .sub-heading').height() + 15;
		$('iframe').attr('height', videoHeight); 
		$('.codeScroll').css('height', videoHeight-subheading);
	}
	resize();
	$(window).resize(function() {
		resize();
	});

	$('.owl-carousel').owlCarousel({
	    loop:false,
	    margin:10,
	    nav:false,
	    autoWidth:false,
	    items:1,
	    center: true,
	    mouseDrag: false,
	    touchDrag: false,
	    pullDrag: false,
	    URLhashListener:true,
	    startPosition: 'URLHash',
	    onChanged : function(event){
	    	console.log(event);
	    	var currentIndex = event.item.index;
	    	$('.owl-links .owl-single').removeClass('active');
	    	$('.owl-links .owl-single').eq(currentIndex).addClass('active');
	    	$('.owl-info-container .owl-info').hide();
	    	$('.owl-info-container .owl-info').eq(currentIndex).fadeIn();
	    }
	});

	$('[data-toggle="tooltip"]').tooltip();
});