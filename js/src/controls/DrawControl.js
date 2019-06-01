var widgets = require('@jupyter-widgets/base');
var _ = require('underscore');
var L = require('../leaflet.js');
var control = require('./Control.js');
var LeafletControlView = control.LeafletControlView;
var LeafletControlModel = control.LeafletControlModel;

var LeafletDrawControlModel = LeafletControlModel.extend({
  defaults: _.extend({}, LeafletControlModel.prototype.defaults, {
        _view_name : 'LeafletDrawControlView',
        _model_name : 'LeafletDrawControlModel',

        polyline : { shapeOptions : {} },
        polygon : { shapeOptions : {} },
        circle : {},
        circlemarker : {},
        rectangle : {},
        marker : {},
        edit : true,
        remove : true
    })
}, {
    serializers: _.extend({
        layer : { deserialize: widgets.unpack_models }
      }, LeafletControlModel.serializers)
});

var LeafletDrawControlView = LeafletControlView.extend({
  initialize: function (parameters) {
        LeafletDrawControlView.__super__.initialize.apply(this, arguments);
        this.map_view = this.options.map_view;
    },

    create_obj: function () {
        var that = this;

        this.feature_group = L.featureGroup();
        this.map_view.obj.addLayer(this.feature_group);

        var polyline = this.model.get('polyline');
        var polygon = this.model.get('polygon');
        var circle = this.model.get('circle');
        var rectangle = this.model.get('rectangle');
        var marker = this.model.get('marker');
        var circlemarker = this.model.get('circlemarker');
        let map = this.map_view.obj;

        //TODO: figure out how to create pm controller without adding it to the
        //map, for now add mock object so that calling code doesn't break
        this.obj = {addTo: ()=>{}};
        const edit = this.model.get('edit');
        const remove = this.model.get('remove');
        //TODO: For now cut + drag are same as edit
        //TODO: deal with shapeOptions

        map.pm.addControls({
            drawPolyline:  !_.isEmpty(polyline),
            drawPolygon:   !_.isEmpty(polygon),
            drawRectangle: !_.isEmpty(rectangle),
            drawCircle:    !_.isEmpty(circle),
            drawMarker:    !_.isEmpty(marker),
            editMode: edit,
            dragMode: edit,
            cutPolygon: edit,
            removalMode: remove,
        });

        let extract_geojson = (layer) => {
            if (layer === undefined) {
                return undefined;
            }

            let geo_json = layer.toGeoJSON();
            geo_json.properties.style = layer.options;
            return geo_json;
        };

        let pm_on_edit = (e) => {
            that.send({
                'event': 'draw:edited',
                'geo_json': extract_geojson(e.target)
            });
       };

        let pm_on_remove = (e) => {
            that.feature_group.removeLayer(e.layer);

            that.send({
                'event': 'draw:deleted',
                'geo_json': extract_geojson(e.layer)
            });
        };

        let pm_on_cut = (e) => {

            let layer = e.layer.getLayers()[0]; //TODO: not sure why this is needed?
            layer.on('pm:edit', pm_on_edit);

            that.feature_group.removeLayer(e.originalLayer);
            that.feature_group.addLayer(layer);

            //TODO: events, should it be custom event instead of deleted+created?
            that.send({
                'event': 'draw:deleted',
                'geo_json': extract_geojson(e.originalLayer)
            });

            that.send({
                'event': 'draw:created',
                'geo_json': extract_geojson(layer)
            });
        };

        let pm_on_create = (e) => {
            e.layer.on('pm:edit', pm_on_edit, that);
            that.feature_group.addLayer(e.layer);

            that.send({
                'event': 'draw:created',
                'geo_json': extract_geojson(e.layer)
            });
        };

        this.map_view.obj.on('pm:cut', pm_on_cut);
        this.map_view.obj.on('pm:create', pm_on_create);
        this.map_view.obj.on('pm:remove', pm_on_remove);
        this.model.on('msg:custom', _.bind(this.handle_message, this));
    },

    handle_message: function(content) {
        if (content.msg == 'clear') {
            this.feature_group.eachLayer((layer) => {
                this.feature_group.removeLayer(layer);
            });
        } else if (content.msg == 'clear_polylines') {
            this.feature_group.eachLayer((layer) => {
                if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
                    this.feature_group.removeLayer(layer);
                }
            });
        } else if (content.msg == 'clear_polygons') {
            this.feature_group.eachLayer((layer) => {
                if (layer instanceof L.Polygon && !(layer instanceof L.Rectangle)) {
                    this.feature_group.removeLayer(layer);
                }
            });
        } else if (content.msg == 'clear_circles') {
            this.feature_group.eachLayer((layer) => {
                if (layer instanceof L.CircleMarker) {
                    this.feature_group.removeLayer(layer);
                }
            });
        } else if (content.msg == 'clear_circle_markers') {
            this.feature_group.eachLayer((layer) => {
                if (layer instanceof L.CircleMarker && !(layer instanceof L.Circle)) {
                    this.feature_group.removeLayer(layer);
                }
            });
        } else if (content.msg == 'clear_rectangles') {
            this.feature_group.eachLayer((layer) => {
                if (layer instanceof L.Rectangle) {
                    this.feature_group.removeLayer(layer);
                }
            });
        } else if (content.msg == 'clear_markers') {
            this.feature_group.eachLayer((layer) => {
                if (layer instanceof L.Marker) {
                    this.feature_group.removeLayer(layer);
                }
            });
        }
    }
});

module.exports = {
  LeafletDrawControlView : LeafletDrawControlView,
  LeafletDrawControlModel : LeafletDrawControlModel,
};
