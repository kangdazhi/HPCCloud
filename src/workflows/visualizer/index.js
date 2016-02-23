import rootNewSimulation    from './components/root/NewSimulation';
import rootViewSimulation   from './components/root/ViewSimulation';

import stepIntroduction     from './components/steps/Introduction';
import stepStartViz         from './components/steps/Visualization/Start';
import stepVisualizer       from './components/steps/Visualization/View';

export default {
    name: 'ParaViewWeb',
    logo: require('./logo.png'),
    components: {
        'NewSimulation': rootNewSimulation,
        'ViewSimulation': rootViewSimulation,
    },
    config: {
        cluster: {
            'config.paraview.installDir': {
                label: 'ParaView Directory',
                description: 'Path to the home directory of ParaView.',
            },
        },
    },
    steps: {
        _order: [ 'Introduction', 'Visualization' ],
        _initial_state: {
            Introduction: {
                type: 'information',
                metadata: {
                    alwaysAvailable: true,
                },
            },
            Visualization: {
                type: 'output',
                metadata: {
                    disabled: false,
                },
            },
        },
        Introduction: {
            default: stepIntroduction,
        },
        Visualization: {
            default: stepStartViz,
            run: stepVisualizer,
        },
    },
    taskFlows: {
        Visualization: 'hpccloud.taskflow.paraview.ParaViewTaskFlow',
    },
    labels: {
        Introduction: {
            default: 'Introduction',
        },
        Visualization: {
            default: 'Visualization',
            run: 'Visualization (running)',
        },
    },
}