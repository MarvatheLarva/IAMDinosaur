const { Architect, Network } = require('synaptic');
const fs = require('fs');
const cloneDeep = require('lodash/cloneDeep');
const robot = require('robotjs');

robot.setKeyboardDelay(0);

exports.Machine = (path, monitoring) => {
    const GENOMES = `${path}/genomes`;
    const GENOMES_PROCEED = `${path}/proceed`;

    const context = {
        current: null,
        keyToggle: null,
        state: {
            key: null,
            start: false
        }
    }

    if(!fs.existsSync(GENOMES)) {
        fs.mkdirSync(GENOMES);
        for (let i = 0; i < 12; i++) {
            const network = new Architect.Perceptron(5, 3, 1);
            fs.writeFileSync(`${GENOMES}/${i < 10 ? '0':''}${i}.genome`, JSON.stringify(network.toJSON()));
        }
    }

    if (!fs.existsSync(GENOMES_PROCEED)) {
        fs.mkdirSync(GENOMES_PROCEED);
    }

    context.current = Network.fromJSON(JSON.parse(fs.readFileSync(`${GENOMES}/${fs.readdirSync(GENOMES)[0]}`)));

    function crossOver(netA, netB) {
        // Swap (50% prob.)
        if (Math.random() > 0.5) {
            var tmp = netA;
            netA = netB;
            netB = tmp;
        }
        
        // Clone network
        netA = cloneDeep(netA);
        netB = cloneDeep(netB);
        
        // Cross over data keys
        crossOverDataKey(netA.neurons, netB.neurons, 'bias');
        
        return netA;
    }

    function crossOverDataKey(a, b, key) {
        var cutLocation = Math.round(a.length * Math.random());
        
        var tmp;
        for (var k = cutLocation; k < a.length; k++) {
            // Swap
            tmp = a[k][key];
            a[k][key] = b[k][key];
            b[k][key] = tmp;
        }
    }

    function mutate(net){
        // Mutate
        mutateDataKeys(net.neurons, 'bias', 0.2);
        
        mutateDataKeys(net.connections, 'weight', 0.2);
        
        return net;
    }

    function mutateDataKeys(a, key, mutationRate){
        for (var k = 0; k < a.length; k++) {
            // Should mutate?
            if (Math.random() > mutationRate) {
            continue;
            }
        
            a[k][key] += a[k][key] * (Math.random() - 0.5) * 3 + (Math.random() - 0.5);
        }
    }

    const self = () => {
        return {
            genome: (inputs) => {
                if (!context.state.start) return;
                
                const output = context.current.activate([inputs.width, inputs.height, inputs.origin, inputs.speed, inputs.distance]);
                // console.log(inputs, output);
                if (output > 0.55) {
                    // console.log('up');
                    clearTimeout(context.keyToggle);
                    robot.keyToggle('down', 'up');
                    robot.keyTap('up');
                    monitoring.logger('-> genome exec JUMP ' + JSON.stringify(inputs));
                }
                if (output < 0.45) {
                    clearTimeout(context.keyToggle);
                    context.keyToggle = setTimeout(() => {
                        robot.keyToggle('down', 'up');
                        context.state.key = null;
                    }, 50);
                    if (context.state.key !== 'down') {
                        robot.keyToggle('down', 'down');
                    }
                    monitoring.logger('-> genome exec CROUCH ' + JSON.stringify(inputs));
                }

            },
            compute: (score) => {
                // console.log(score);
                fs.writeFileSync(`${GENOMES_PROCEED}/${'00000'.slice(0, Math.trunc(5 - score / 10) + 1)}${score}-${Date.now()}.genome`, JSON.stringify(context.current.toJSON()));
                fs.unlinkSync(`${GENOMES}/${fs.readdirSync(GENOMES).shift()}`);

                if (fs.readdirSync(GENOMES).length === 0) {
                    monitoring.logger('GENERATION END / CROSS OVER / MUTATE');
                    console.log('GENERATION END / CROSS OVER / MUTATE');
                    // get TWO BESTs genomes
                    const [genA, genB] = fs.readdirSync(GENOMES_PROCEED).reverse().slice(0, 2).map(e => JSON.parse(fs.readFileSync(`${GENOMES_PROCEED}/${e}`)));
                    const mutation = mutate(crossOver(genA, genB));

                    fs.writeFileSync(`${GENOMES}/${01}.genome`, JSON.stringify(mutation));

                    for (let i = 1; i < 12; i++) {
                        fs.writeFileSync(`${GENOMES}/${i < 10 ? '0':''}${i}.genome`, JSON.stringify(mutate(mutation)));
                    }

                    fs.readdirSync(GENOMES_PROCEED).map(e => fs.unlinkSync(`${GENOMES_PROCEED}/${e}`));

                    context.current = Network.fromJSON(JSON.parse(fs.readFileSync(`${GENOMES}/${fs.readdirSync(GENOMES)[0]}`)));
                }
            },
            start: () => {
                context.state.start = true;
            },
            stop: () => {
                context.state.start = false; 
                context.state.key = null;
                robot.keyToggle('down', 'up');
                robot.keyToggle('up', 'up');
             }
        }
    }

    return self();
}