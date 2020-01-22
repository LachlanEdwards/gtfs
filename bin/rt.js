var gtfs = require('gtfs-stream')
var request = require('request')

module.exports = {
  get: (_agency) => {
    return new Promise((resolve, reject) => {
      let res = [];
      request.get(_agency)
        .pipe(gtfs.rt())
        .on('data', (stream) => {
          res.push(stream);
        })
        .on('error', (err) => {
          reject(`PromiseRejection: ${err}`);
        })
        .on('end', () => {
          resolve(res);
        })
    })
  },
  geojson: async (_agency) => {
    return new Promise(async (resolve, reject) => {
      var gtf = await rt.get(_agency).catch(err => reject(`PromiseRejection: ${err}`));
      var res = {
        "type": "FeatureCollection",
        "crs": { "type": "name", "properties": { "name": "TransLink GTFS Real-Time Feed" } },
        "features": []
      };
      for (i in gtf)
        if (gtf[i].vehicle)
          res["features"].push({
            "type": "Feature",
            "geometry": {
              "type": "Point",
              "coordinates": [gtf[i].vehicle.position.longitude, gtf[i].vehicle.position.latitude]
            },
            "properties": {
              "name": "vehicle"
            }
          })
      resolve(res);
    })
  }
}
