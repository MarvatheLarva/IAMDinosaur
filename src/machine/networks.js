const { Architect, Network } = require('synaptic');
const fs = require('fs');
const uuid = require('uuid');

const { Genetics } = require('./genetics');

exports.Networks = function(config, monitoring) {
    const genetics = Genetics({}, monitoring);

    const networks = {
        'process': {
            location: ((location) => `${location}/process`)(config.location),
            initialize: () => {
                monitoring.logger(`[MACHINE][networks] -> process initialize`);

                for (let i = 0; i < config.generations; i++) {
                    const network = new Architect.Perceptron(config.input, config.layer, config.output);
    
                    // write network into file
                    networks.process.store(network);
                }
            },
            pick: () => {
                monitoring.logger(`[MACHINE][networks] -> process pick`);

                const location = networks.process.location;

                const filename = fs.readdirSync(location).filter(e => e.match('.network')).slice(0, 1)[0];
                const path = `${location}/${filename}`;

                return { location: path, network: Network.fromJSON(JSON.parse(fs.readFileSync(path))) };
            },
            store: (network) => {
                monitoring.logger(`[MACHINE][networks] -> process store`);

                const location = networks.process.location;
                const filename =  `${uuid.v4()}.network`;
                
                const path = `${location}/${filename}`;

                if (!fs.existsSync(location)) { fs.mkdirSync(location, { recursive: true }) }

                fs.writeFileSync(path,  JSON.stringify(network));
            },
            isEmpty: () => {
                const location = networks.process.location;
                return !(fs.existsSync(location) && !!fs.readdirSync(location).filter(e => e.match('.network')).length);
            },
            stats: () => {
                const location = networks.process.location;

                const genomes = fs.readdirSync(location).filter(e => e.match('.network'));

                return {
                    running: 1 + config.generations-genomes.length,
                    current: genomes.slice(0, 1)[0],
                }
            }
        },
        'processed': {
            location: ((location) => `${location}/processed`)(config.location),
            meddle: () => {
                monitoring.logger(`[MACHINE][networks] -> processed meedle`);

                // pick & archive LEGACY 2 bests processed networks from PROCESSED
                const location = networks.processed.location;
                const score = (filename) => Number(filename.match(/[\d]{15}/).shift());

                const [best1, best2] = fs.readdirSync(location)
                    .filter(e => e.match('.network'))
                    .sort((a, b) =>  score(b) - score(a))
                    .slice(0, 2)
                    .map(filename => Object.assign({}, { score: score(filename), network: JSON.parse(fs.readFileSync(`${location}/${filename}`)) }));

                networks.legacy.store(best1.network, best1.score);
                networks.legacy.store(best2.network, best2.score);

                networks.processed.clean();

                const mutation = genetics.mutate(genetics.crossOver(best1.network, best2.network));
                networks.process.store(mutation);

                for (let i = 0; i < config.generations - 1; i++) {
                    networks.process.store(genetics.mutate(mutation));
                }
            },
            clean: () => {
                monitoring.logger(`[MACHINE][networks] -> processed cleans`);

                const location = networks.processed.location;

                fs.readdirSync(location)
                    .filter(e => e.match('.network'))
                    .map(e => fs.unlinkSync(`${location}/${e}`))
            },
            store: (processLocation, network, score) => {
                monitoring.logger(`[MACHINE][networks] -> processed store`);

                const location = networks.processed.location;
                const scoreString = String(score);
                const placeholdder = '000000000000000';
                const filename =  `${placeholdder.slice(0, placeholdder.length - scoreString.length)}${scoreString}-${uuid.v4()}.network`;
                const path = `${location}/${filename}`;

                if (!fs.existsSync(location)) { fs.mkdirSync(location, { recursive: true }) }

                fs.writeFileSync(path,  JSON.stringify(network));

                fs.unlinkSync(processLocation);
            }
        },
        'legacy': {
            location: ((location) => `${location}/legacy`)(config.location),
            store: (network, score) => {
                monitoring.logger(`[MACHINE][networks] -> legacy store`);

                const location = networks.legacy.location;
                const scoreString = String(score);
                const placeholdder = '000000000000000';

                const filename =  `${placeholdder.slice(0, placeholdder.length - scoreString.length)}${scoreString}-${uuid.v4()}.network`;
                const path = `${location}/${filename}`;

                if (!fs.existsSync(location)) { fs.mkdirSync(location, { recursive: true }) }

                fs.writeFileSync(path,  JSON.stringify(network));
            },
            stats: () => {
                const location = networks.legacy.location;
                const score = (filename) => Number(filename.match(/[\d]{15}/).shift());

                if (!fs.existsSync(location)) { fs.mkdirSync(location, { recursive: true }) }

                const genomes = fs.readdirSync(location)
                    .filter(e => e.match('.network'))
                    .sort((a, b) =>  score(b) - score(a));

                return {
                    iterations: genomes.length / 2,
                    top10: genomes.slice(0, 10).map(e => [score(e), e.replace(/^[\d]{1,}-/, '', ), fs.statSync(`${location}/${e}`).mtime])
                }
            }
        }
    };

    return networks;
}