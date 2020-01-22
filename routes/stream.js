var express = require('express');
var router = express.Router();
var gtfs = require('gtfs-stream')
var request = require('request')
var agency = require('../bin/agency')
var pool = require('../bin/pool')

/* GET home page. */
router.get('/', async function(req, res, next) {
  res.json(await helper.get(agency.Australia.Brisbane));
});

router.get('/map', async function(req, res, next) {
  res.render('index', {
    geojson: await helper.geojson(agency.Australia.Brisbane).catch(err => { console.error(`PromiseRejection: ${err}`) })
  });
});

let helper = {
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
      var pg = await pool.connect();
      var res = {
        "type": "FeatureCollection",
        "crs": { "type": "name", "properties": { "name": "TransLink GTFS Real-Time Feed" } },
        "features": []
      };
      try {
        var response = await pg.query('SELECT route_id, position_longitude, position_latitude FROM vehicle_positions');
        var rows = response.rows;
        for (i in rows)
          res["features"].push({
            "type": "Feature",
            "geometry": {
              "type": "Point",
              "coordinates": [rows[i].position_longitude, rows[i].position_latitude]
            },
            "properties": {
              "name": rows[i].route_id.split('-')[0]
            }
          })
        resolve(res);
      } catch (err) {
        console.error(`Query failed. Reason: ${err}.`);
      }
    })
  }
}

module.exports = router;
