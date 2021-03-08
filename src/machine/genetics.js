exports.Genetics = function(config, monitoring) {
    function crossOver(netA, netB) {
        monitoring.logger(`[MACHINE][genetics] -> crossOver`);

        // Swap (50% prob.)
        if (Math.random() > 0.5) {
            var tmp = netA;
            netA = netB;
            netB = tmp;
        }
        
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

    function mutate(net) {
        monitoring.logger(`[MACHINE][genetics] -> mutate`);

        // Mutate
        mutateDataKeys(net.neurons, 'bias', 0.2);
        
        mutateDataKeys(net.connections, 'weight', 0.2);
        
        return net;
    }

    function mutateDataKeys(a, key, mutationRate) {
        for (var k = 0; k < a.length; k++) {
            // Should mutate?
            if (Math.random() > mutationRate) { continue }
        
            a[k][key] += a[k][key] * (Math.random() - 0.5) * 3 + (Math.random() - 0.5);
        }
    }

    return {
        crossOver,
        crossOverDataKey,
        mutate,
        mutateDataKeys,
    }
}