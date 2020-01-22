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

router.get('/geo', async function(req, res, next) {
  res.json(await helper.geo(agency.Australia.Brisbane).catch(err => { console.error(`PromiseRejection: ${err}`) }));
});

router.get('/geo/:stop', async function(req, res, next) {
  var stop = req.params.stop;

  res.json(await helper.geo_stop(agency.Australia.Brisbane, stop).catch(err => { console.error(`PromiseRejection: ${err}`) }));
});

router.get('/stop/:stop', async function(req, res, next) {
  var stop = req.params.stop;
  res.json(await helper.stop(agency.Australia.Brisbane, stop).catch(err => {console.error(`PromiseRejection: ${err}`) }));
})

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
  stop: async (_agency, stop) => {
    return new Promise(async (resolve, reject)=> {
      try {
        var pg = await pool.connect();
        var text = 'SELECT * FROM stop_time INNER JOIN trip ON stop_time.trip_update_id  = trip.trip_id WHERE stop_id = $1 ';
        var values = [stop];
        var response = await pg.query(text, values);
        resolve(response.rows);
      } catch (err) {
        console.error(`Query failed. Reason: ${err}.`);
        reject(err);
      }
    })
  },
  geo_stop: async (_agency, stop) => {
    return new Promise(async (resolve, reject) => {
      var pg = await pool.connect();
      var res = {
        "type": "FeatureCollection",
        "crs": { "type": "name", "properties": { "name": "TransLink GTFS Real-Time Feed" } },
        "features": []
      };
      try {
        var text = 'SELECT * FROM vehicle_positions INNER JOIN stop_time ON vehicle_positions.trip_id  = stop_time.trip_update_id WHERE stop_id = $1 ';
        var values = [stop];
        var response = await pg.query(text, values);
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
        reject(err);
        console.error(`Query failed. Reason: ${err}.`);
      }
    })
  },
  geo: async (_agency) => {
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
        reject(err);
        console.error(`Query failed. Reason: ${err}.`);
      }
    })
  }
}

module.exports = router;
