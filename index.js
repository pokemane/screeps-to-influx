const { ScreepsAPI } = require('screeps-api');
const fs = require('fs');
const { email, password } = require('./auth');
const _ = require('lodash');
const Influx = require('influx');
const hosts = require('./hostconfig');

const influx = new Influx.InfluxDB({
    host: hosts.influx,
    database: 'screeps',
    schema: [
        {
            database: 'screeps',
            measurement: 'cpu_stats',
            fields: {
                used: Influx.FieldType.FLOAT,
                limit: Influx.FieldType.FLOAT,
                bucket: Influx.FieldType.FLOAT
            },
            tags: [
                'user'
            ]
        },
        {
            database: 'screeps',
            measurement: 'gcl',
            fields: {
                level: Influx.FieldType.FLOAT,
                progress_total: Influx.FieldType.FLOAT,
                progress: Influx.FieldType.FLOAT
            },
            tags: [
                'user'
            ]
        },
        {
            database: 'screeps',
            measurement: 'room_stats',
            fields: {
                controller_level: Influx.FieldType.INTEGER,
                controller_progress: Influx.FieldType.FLOAT,
                controller_progress_total: Influx.FieldType.FLOAT,
                spawn_energy_available: Influx.FieldType.FLOAT,
                spawn_energy_capacity_available: Influx.FieldType.FLOAT,
                room_energy_storage: Influx.FieldType.FLOAT
            },
            tags: [
                'user',
                'room'
            ]
        }
    ]
})

const p_api = new ScreepsAPI({
    protocol: 'http',
    hostname: hosts.screeps,
    port: 21025,
    path: '/'
  });

async function p_auth() {
    var ret = await p_api.auth(email, password);
    return ret;
}

async function getstats() {
    let memory = await p_api.memory.get('stats');
    let userinfo = await p_api.me();
    // fs.writeFileSync('memory.json', JSON.stringify(memory,null,'  '));
    return Promise.resolve([memory, userinfo]);
}

async function sendToInflux([memory, userinfo]) {
    let roomdata = [];
    // build room info
    for (var roomName in memory.data.rooms) {
        var room = memory.data.rooms[roomName];
        roomdata.push({
            measurement: 'room_stats',
            tags: { 
                user: userinfo.username,
                room: roomName
            },
            fields: {
                controller_level: room.rclLevel,
                controller_progress: room.rclProgress,
                controller_progress_total: room.rclProgressTotal,
                spawn_energy_available: room.spawnEnergy,
                spawn_energy_capacity_available: room.spawnEnergyTotal,
                room_energy_storage: room.storageEnergy
            }
        })
    }

    influx.writePoints([
        {
            measurement: 'cpu_stats',
            tags: { user: userinfo.username },
            fields: {
                used: memory.data.cpuUsed,
                limit: memory.data.cpuLimit,
                bucket: memory.data.cpuBucket
            }
        },
        {
            measurement: 'gcl',
            tags: { user: userinfo.username },
            fields: {
                level: memory.data.gclLevel,
                progress_total: memory.data.gclProgressTotal,
                progress: memory.data.gclProgress
            }
        },
        ...roomdata
    ]);
}


async function run() {
    p_auth()
        .then(getstats)
        .then(sendToInflux)
        .catch(err => console.error(err));
}

if (require.main === module) {
    setInterval(run, 5000);
}
