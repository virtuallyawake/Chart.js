(function(){
    "use strict";

    var root = this,
    Chart = root.Chart,
    helpers = Chart.helpers;

    var defaultConfig = {

	///Boolean - Whether grid lines are shown across the chart
	scaleShowGridLines : true,

	//String - Colour of the grid lines
	scaleGridLineColor : "rgba(0,0,0,.05)",

	//Number - Width of the grid lines
	scaleGridLineWidth : 1,

	//Boolean - Whether to show a dot for each point
	pointDot : true,

	//Number - Radius of each point dot in pixels
	pointDotRadius : 4,

	//Number - Pixel width of point dot stroke
	pointDotStrokeWidth : 1,

	//Number - amount extra to add to the radius to cater for hit detection outside the drawn point
	pointHitDetectionRadius : 20,

	//Boolean - Whether to show a stroke for datasets
	datasetStroke : true,

	//Number - Pixel width of dataset stroke
	datasetStrokeWidth : 2,

	//Boolean - Whether to fill the dataset with a colour
	datasetFill : true,

	//String - A legend template
	legendTemplate : "<ul class=\"<%=name.toLowerCase()%>-legend\"><% for (var i=0; i<datasets.length; i++){%><li><span style=\"background-color:<%=datasets[i].strokeColor%>\"></span><%if(datasets[i].label){%><%=datasets[i].label%><%}%></li><%}%></ul>",

	// String - Template string for single tooltips
	tooltipTemplate: "<%if (label){%><%=label%>, <%}%><%= value %>",
    };


    Chart.Type.extend({
	name: "Scatterplot",
	defaults : defaultConfig,
	xScale: (function() {
	    var scale = [];
	    
	    function setScale(min, max) {
		console.log("min: " + min + ", max: " + max);
		var newMin = Math.floor(min*100)/100;
		var newMax = Math.ceil(max*100)/100;
		console.log("newMin: " + newMin + ", newMax: " + newMax);
		var step = (newMax-newMin)/10;
		step = step.toExponential(0);
		step = Number(step);
		console.log("step: " + step);
		var i;
		for (i=newMin; i<=newMax; i=i+step) {
		    console.log(i);
		    scale.push(i);
		}
		scale.push(i);
	    }

	    function getScale() {
		return scale;
	    }

	    function getScaleMin() {
		return scale[0];
	    }

	    return {
		setScale : setScale,
		getScale : getScale,
		getScaleMin: getScaleMin
	    };
	})(),
	initialize:  function(data){
	    //Declare the extension of the default point, to cater for the options passed in to the constructor
	    this.PointClass = Chart.Point.extend({
		strokeWidth : this.options.pointDotStrokeWidth,
		radius : this.options.pointDotRadius,
		display: this.options.pointDot,
		hitDetectionRadius : this.options.pointHitDetectionRadius,
		ctx : this.chart.ctx,
		inRange : function(mouseX){
		    return (Math.pow(mouseX-this.x, 2) < Math.pow(this.radius + this.hitDetectionRadius,2));
		}
	    });

	    this.datasets = [];

	    //Set up tooltip events on the chart
	    if (this.options.showTooltips){
		helpers.bindEvents(this, this.options.tooltipEvents, function(evt){
		    var activePoints = (evt.type !== 'mouseout') ? this.getPointsAtEvent(evt) : [];
		    this.eachPoints(function(point){
			point.restore(['fillColor', 'strokeColor']);
		    });
		    helpers.each(activePoints, function(activePoint){
			activePoint.fillColor = activePoint.highlightFill;
			activePoint.strokeColor = activePoint.highlightStroke;
		    });
		    this.showTooltip(activePoints);
		});
	    }

	    // Min and max values of x axis
	    var xScaleMin, xScaleMax;
	    var counter = 0;

	    //Iterate through each of the datasets, and build this into a property of the chart
	    helpers.each(data.datasets,function(dataset){

		var datasetObject = {
		    label : dataset.label || null,
		    fillColor : dataset.fillColor,
		    strokeColor : dataset.strokeColor,
		    pointColor : dataset.pointColor,
		    pointStrokeColor : dataset.pointStrokeColor,
		    points : []
		};

		this.datasets.push(datasetObject);

		// Iterate through all points in a dataset
		helpers.each(dataset.dataY,function(dataPoint,index){
		    //Add a new point for each piece of data, passing any required data to draw.
		    datasetObject.points.push(new this.PointClass({
			value : dataPoint,
			valueX : dataset.dataX[index],
			label : dataset.dataX[index],
			datasetLabel: dataset.label,
			strokeColor : dataset.pointStrokeColor,
			fillColor : dataset.pointColor,
			highlightFill : dataset.pointHighlightFill || dataset.pointColor,
			highlightStroke : dataset.pointHighlightStroke || dataset.pointStrokeColor
		    }));

		    // Store the min and max values of the x axis
		    var valueX = dataset.dataX[index];
		    if (!xScaleMin)
			xScaleMin = valueX;
		    
		    if (!xScaleMax)
			xScaleMax = valueX;
		    
		    xScaleMin = (valueX < xScaleMin) ? valueX : xScaleMin;
		    xScaleMax = (valueX > xScaleMax) ? valueX : xScaleMax;
		    
		    counter++;
		},this);

	    },this);

	    // Generate the x-axis scale
	    this.xScale.setScale(xScaleMin, xScaleMax);

	    this.buildScale(this.xScale.getScale());

	    this.eachPoints(function(point, index){
		helpers.extend(point, {
		    x: this.scale.calculateX(index),
		    y: this.scale.endPoint
		});
		point.save();
	    }, this);

	    this.render();
	},
	update : function(){
	    this.scale.update();
	    // Reset any highlight colours before updating.
	    helpers.each(this.activeElements, function(activeElement){
		activeElement.restore(['fillColor', 'strokeColor']);
	    });
	    this.eachPoints(function(point){
		point.save();
	    });
	    this.render();
	},
	eachPoints : function(callback){
	    helpers.each(this.datasets,function(dataset){
		helpers.each(dataset.points,callback,this);
	    },this);
	},
	getPointsAtEvent : function(e){
	    var pointsArray = [],
	    eventPosition = helpers.getRelativePosition(e);
	    helpers.each(this.datasets,function(dataset){
		helpers.each(dataset.points,function(point){
		    if (point.inRange(eventPosition.x,eventPosition.y)) pointsArray.push(point);
		});
	    },this);
	    return pointsArray;
	},
	buildScale : function(labels){
	    var self = this;

	    var dataTotal = function(){
		var values = [];
		self.eachPoints(function(point){
		    values.push(point.value);
		});

		return values;
	    };

	    var scaleOptions = {
		templateString : this.options.scaleLabel,
		height : this.chart.height,
		width : this.chart.width,
		ctx : this.chart.ctx,
		textColor : this.options.scaleFontColor,
		fontSize : this.options.scaleFontSize,
		fontStyle : this.options.scaleFontStyle,
		fontFamily : this.options.scaleFontFamily,
		valuesCount : labels.length,
		beginAtZero : this.options.scaleBeginAtZero,
		integersOnly : this.options.scaleIntegersOnly,
		calculateYRange : function(currentHeight){
		    var updatedRanges = helpers.calculateScaleRange(
			dataTotal(),
			currentHeight,
			this.fontSize,
			this.beginAtZero,
			this.integersOnly
		    );
		    helpers.extend(this, updatedRanges);
		},
		xLabels : labels,
		font : helpers.fontString(this.options.scaleFontSize, this.options.scaleFontStyle, this.options.scaleFontFamily),
		lineWidth : this.options.scaleLineWidth,
		lineColor : this.options.scaleLineColor,
		gridLineWidth : (this.options.scaleShowGridLines) ? this.options.scaleGridLineWidth : 0,
		gridLineColor : (this.options.scaleShowGridLines) ? this.options.scaleGridLineColor : "rgba(0,0,0,0)",
		padding: (this.options.showScale) ? 0 : this.options.pointDotRadius + this.options.pointDotStrokeWidth,
		showLabels : this.options.scaleShowLabels,
		display : this.options.showScale
	    };

	    if (this.options.scaleOverride){
		helpers.extend(scaleOptions, {
		    calculateYRange: helpers.noop,
		    steps: this.options.scaleSteps,
		    stepValue: this.options.scaleStepWidth,
		    min: this.options.scaleStartValue,
		    max: this.options.scaleStartValue + (this.options.scaleSteps * this.options.scaleStepWidth)
		});
	    }


	    this.scale = new Chart.Scale(scaleOptions);
	},
	addData : function(valuesArray,label){
	    //Map the values array for each of the datasets

	    helpers.each(valuesArray,function(value,datasetIndex){
		//Add a new point for each piece of data, passing any required data to draw.
		this.datasets[datasetIndex].points.push(new this.PointClass({
		    value : value,
		    label : label,
		    x: this.scale.calculateX(this.scale.valuesCount+1),
		    y: this.scale.endPoint,
		    strokeColor : this.datasets[datasetIndex].pointStrokeColor,
		    fillColor : this.datasets[datasetIndex].pointColor
		}));
	    },this);

	    this.scale.addXLabel(label);
	    //Then re-render the chart.
	    this.update();
	},
	removeData : function(){
	    this.scale.removeXLabel();
	    //Then re-render the chart.
	    helpers.each(this.datasets,function(dataset){
		dataset.points.shift();
	    },this);
	    this.update();
	},
	reflow : function(){
	    var newScaleProps = helpers.extend({
		height : this.chart.height,
		width : this.chart.width
	    });
	    this.scale.update(newScaleProps);
	},
	draw : function(ease){
	    var easingDecimal = ease || 1;
	    this.clear();

	    var ctx = this.chart.ctx;

	    // Some helper methods for getting the next/prev points
	    var hasValue = function(item){
		return item.value !== null;
	    },
	    nextPoint = function(point, collection, index){
		return helpers.findNextWhere(collection, hasValue, index) || point;
	    },
	    previousPoint = function(point, collection, index){
		return helpers.findPreviousWhere(collection, hasValue, index) || point;
	    };

	    this.scale.draw(easingDecimal);


	    helpers.each(this.datasets,function(dataset){
		var pointsWithValues = helpers.where(dataset.points, hasValue);

		//Transition each point first so that the line and point drawing isn't out of sync
		//We can use this extra loop to calculate the control points of this dataset also in this loop

		helpers.each(dataset.points, function(point, index){
		    if (point.hasValue()){
			point.transition({
			    y : this.scale.calculateY(point.value),
			    x : this.scale.calculateX(point.valueX - this.xScale.getScaleMin())
			}, easingDecimal);
		    }
		},this);

		//Now draw the points
		helpers.each(pointsWithValues,function(point){
		    point.draw();
		});
	    },this);
	}
    });


}).call(this);
