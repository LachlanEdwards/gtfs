var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var lessMiddleware = require('less-middleware');
var logger = require('morgan');
var hbs = require('hbs');
var rt = require('./bin/rt');
var agency = require('./bin/agency')
const pool = require('./bin/pool')

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var streamRouter = require('./routes/stream');
var rtRouter = require('./routes/rt');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
hbs.registerHelper('json', function(context) {
  return JSON.stringify(context);
});

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(lessMiddleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/stream', streamRouter);
app.use('/rt', rtRouter);
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

let update = {
  default: async () => {
    const trips = [];
    const vehicles = [];
    rt.get(agency.Australia.Brisbane).then(async (res) => {
      for (i in res)
        if (res[i].tripUpdate) {
          trips.push(res[i]);
        } else if (res[i].vehicle) {
          vehicles.push(res[i])
        }
      await update.trip(trips);
      await update.position(vehicles);
      console.log(`Updated database at ${new Date().toISOString()}`);
      update.default();
    });
  },
  parseInt: (int) => {
    var res = parseInt(int);
    if (isNaN(res)) {
      return null;
    } else {
      return res;
    }
  },
  position: async (input) => {
    const pg = await pool.connect();
    try {
      await pg.query('BEGIN');
      await pg.query('DELETE FROM vehicle_positions');
      console.log(`Inserting ${input.length} rows into table vehicle_positions.`);
      var text = 'INSERT INTO vehicle_positions(trip_id, route_id, trip_start_time, trip_start_date, vehicle_id, vehicle_label, vehicle_license_plate, position_latitude, position_longitude, position_bearing, position_speed, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, to_timestamp($12))'
      for (j in input)
        try {
          var row = {
            tripId: input[j].vehicle.trip.tripId || null,
            routeId: input[j].vehicle.trip.routeId || null,
            tripStartTime: null,
            tripStartDate: null,
            vehicleId: input[j].vehicle.vehicle.id || null,
            vehicleLabel: input[j].vehicle.vehicle.label || null,
            vehicleLicensePlate: input[j].vehicle.licensePlate || null,
            positionLatitude: input[j].vehicle.position ? input[j].vehicle.position.latitude : null,
            positionLongitude: input[j].vehicle.position ? input[j].vehicle.position.longitude : null,
            positionBearing: input[j].vehicle.position ? input[j].vehicle.position.bearing : null,
            positionSpeed: input[j].vehicle.position ? input[j].vehicle.position.speed : null,
            timestamp: input[j].vehicle.timestamp || null,
          }
          var values = [row.tripId, row.routeId, row.tripStartTime, row.tripStartDate, row.vehicleId, row.vehicleLabel, row.vehicleLicensePlate, parseFloat(row.positionLatitude), parseFloat(row.positionLongitude), parseFloat(row.positionBearing), parseFloat(row.positionSpeed), update.parseInt(row.timestamp)];
          await pg.query(text, values);
        } catch (err) {
          console.log(`Failed to insert row ${JSON.stringify(input[j])}. Reason: ${err}`);
        }
    } catch (err) {
      console.log(err);
      await pg.query('ROLLBACK');
    } finally {
      await pg.query('COMMIT');
      await pg.release();
      console.log(`Committed ${input.length} rows into table vehicle_positions.`);
    }
  },
  stopTimeUpdate: async (input) => {
    const pg = await pool.connect();
    try {
      await pg.query('BEGIN');
      await pg.query('DELETE FROM stop_time');
      console.log(`Inserting ${input.length} rows into table stop_time.`);
      var text = 'INSERT INTO stop_time(stop_sequence, stop_id, arrival_delay, arrival_time, arrival_uncertainty, departure_delay, departure_time, departure_uncertainty, schedule_relationship, trip_update_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)'
      for (j in input)
        try {
          var row = {
            stopSequence: input[j].stopSequence || null,
            stopId: input[j].stopId || null,
            arrivalDelay: input[j].arrival ? input[j].arrival.delay : null,
            arrivalTIme: input[j].arrival ? input[j].arrival.time : null,
            arrivalUncertainty: input[j].arrival ? input[j].arrival.uncertainty : null,
            departureDelay: input[j].departure ? input[j].departure.delay : null,
            departureTIme: input[j].departure ? input[j].departure.time : null,
            departureUncertainty: input[j].departure ? input[j].departure.uncertainty : null,
            scheduleRelationship: input[j].scheduleRelationship,
            tripUpdateId: input[j].tripUpdateId
          }
          var values = [update.parseInt(row.stopSequence), update.parseInt(row.stopId), update.parseInt(row.arrivalDelay), update.parseInt(row.arrivalTIme), update.parseInt(row.arrivalUncertainty), update.parseInt(row.departureDelay), update.parseInt(row.departureTIme), update.parseInt(row.departureUncertainty), row.scheduleRelationship, row.tripUpdateId];
          await pg.query(text, values);
        } catch (err) {
          console.log(`Failed to insert row ${JSON.stringify(input[j])}. Reason: ${err}`);
        }
    } catch (err) {
      console.log(err);
      await pg.query('ROLLBACK');
    } finally {
      await pg.query('COMMIT');
      await pg.release();
      console.log(`Committed ${input.length} rows into table stop_time.`);
    }
  },
  trip: async (input) => {
    const pg = await pool.connect();
    const stu = [];
    try {
      await pg.query('BEGIN');
      await pg.query('DELETE FROM trip');
      console.log(`Inserting ${input.length} rows into table trip..`);
      var text = 'INSERT INTO trip(trip_id, route_id, trip_start_time, trip_start_date, schedule_relationship, vehicle_id, vehicle_label, vehicle_license_plate, timestamp, oid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9), $10)'
      for (i in input)
        try {
          var row = {
            tripId: input[i].tripUpdate.trip.tripId || null,
            routeId: input[i].tripUpdate.trip.routeId || null,
            startTime: input[i].tripUpdate.trip.startTime || null,
            startDate: input[i].tripUpdate.trip.startDate || null,
            scheduleRelationship: input[i].tripUpdate.trip.scheduleRelationship || null,
            vehicleId: input[i].tripUpdate.vehicle ? input[i].tripUpdate.vehicle.id : null,
            vehicleLabel: input[i].tripUpdate.vehicle ? input[i].tripUpdate.vehicle.label : null,
            vehicleLicensePlate: input[i].tripUpdate.vehicle ? input[i].tripUpdate.vehicle.licensePlate : null,
            timestamp: input[i].tripUpdate.timestamp || null,
            oid: input[i].id || null
          }
          var values = [row.tripId, row.routeId, row.startTime, row.startDate, row.scheduleRelationship, row.vehicleId, row.vehicleLabel, row.vehicleLicensePlate, update.parseInt(row.timestamp), row.oid]
          await pg.query(text, values);
          var stopTimeUpdates = input[i].tripUpdate.stopTimeUpdate;
          if (stopTimeUpdates) {
            for (j in stopTimeUpdates) {
              stopTimeUpdates[j].tripUpdateId = row.tripId;
              stopTimeUpdates[j].scheduleRelationship = row.scheduleRelationship;
              stu.push(stopTimeUpdates[j])
            }
          }
        } catch (err) {
          console.log(`Failed to insert row ${JSON.stringify(input[i])}. Reason: ${err}`);
        }
    } catch (err) {
      console.log(err);
      await pg.query('ROLLBACK');
    } finally {
      await pg.query('COMMIT');
      await pg.release();
      console.log(`Committed ${input.length} rows into table trip.`);
      await update.stopTimeUpdate(stu);
    }
  }
}

update.default();
module.exports = app;
