import React                   from 'react';

import ButtonBar               from '../../../../../../panels/ButtonBar';
import defaultServerParameters from '../../../../../../panels/run/defaults';
import RunCluster              from '../../../../../../panels/run/RunCluster';
import RunEC2                  from '../../../../../../panels/run/RunEC2';
import RunOpenStack            from '../../../../../../panels/run/RunOpenStack';
import RuntimeBackend          from '../../../panels/RuntimeBackend';

// import client                  from '../../../../../../network';
// import deepClone               from 'mout/src/lang/deepClone';
import merge                   from 'mout/src/object/merge';
import formStyle               from 'HPCCloudStyle/ItemEditor.mcss';

import { connect } from 'react-redux';
import get          from 'mout/src/object/get';
import { dispatch } from '../../../../../../redux';
import * as Actions from '../../../../../../redux/actions/taskflows';

const SimulationStart = React.createClass({

  displayName: 'pyfr/common/steps/Simulation/Start',

  propTypes: {
    location: React.PropTypes.object,
    project: React.PropTypes.object,
    simulation: React.PropTypes.object,
    step: React.PropTypes.string,
    taskFlowName: React.PropTypes.string,
    primaryJob: React.PropTypes.string,
    view: React.PropTypes.string,

    error: React.PropTypes.string,
    tradClusters: React.PropTypes.object,
    ec2Clusters: React.PropTypes.object,
    onRun: React.PropTypes.func,
  },

  getInitialState() {
    return {
      serverType: 'Traditional',
      EC2: defaultServerParameters.EC2,
      Traditional: defaultServerParameters.Traditional,
      OpenStack: defaultServerParameters.OpenStack,

      backend: {},
      error: '',
    };
  },

  dataChange(key, value, which) {
    var profile = this.state[which];
    profile[key] = value;
    this.setState({ [which]: profile });
  },

  runSimulation() {
    const meshFile = this.props.simulation.metadata.inputFolder.files.mesh || this.props.project.metadata.inputFolder.files.mesh;
    var clusterName,
      sessionId = btoa(new Float64Array(3).map(Math.random)).substring(0, 96),
      payload;


    if (this.state.serverType === 'Traditional') {
      clusterName = this.props.tradClusters[this.state[this.state.serverType].profile].name;
      payload = Object.assign({},
        this.state[this.state.serverType].runtime || {},
        {
          backend: this.state.backend,
          input: {
            folder: {
              id: this.props.simulation.metadata.inputFolder._id,
            },
            meshFile: {
              id: meshFile,
            },
            iniFile: {
              id: this.props.simulation.metadata.inputFolder.files.ini,
            },
          },
          output: {
            folder: {
              id: this.props.simulation.metadata.outputFolder._id,
            },
          },
          cluster: {
            _id: this.state[this.state.serverType].profile,
          },
        });
    } else if (this.state.serverType === 'EC2') {
      // clusterName = this.props.ec2Clusters[this.state[this.state.serverType].profile].name;
      const profileId = this.state[this.state.serverType].profile._id;
      const clusterSize = !isNaN(parseFloat(this.state[this.state.serverType].clusterSize)) ? parseFloat(this.state[this.state.serverType].clusterSize) : 1;
      clusterName = this.state[this.state.serverType].profile.name;
      payload = Object.assign({},
        this.state[this.state.serverType].runtime || {},
        {
          backend: this.state.backend,
          input: {
            folder: {
              id: this.props.simulation.metadata.inputFolder._id,
            },
            meshFile: {
              id: meshFile,
            },
            iniFile: {
              id: this.props.simulation.metadata.inputFolder.files.ini,
            },
          },
          output: {
            folder: {
              id: this.props.simulation.metadata.outputFolder._id,
            },
          },
          cluster: {
            serverType: 'ec2',
            name: clusterName,
            machineType: this.state[this.state.serverType].machine,
            clusterSize,
            profileId,
            // volumeSize: parseFloat(this.state[this.state.serverType].volumeSize),
          },
        });
    }

    this.props.onRun(
      this.props.taskFlowName,
      this.props.primaryJob,
      payload,
      {
        id: this.props.simulation._id,
        step: 'Simulation',
        data: {
          view: 'run',
          metadata: {
            sessionId,
            cluster: clusterName,
          },
        },
      },
      {
        pathname: this.props.location.pathname,
        query: merge(this.props.location.query, {
          view: 'run',
        }),
        state: this.props.location.state,
      });
  },

  formAction(action) {
    this[action]();
  },

  updateServerType(e) {
    const serverType = e.target.value;
    this.setState({ serverType });
  },

  updateBakend(backend) {
    this.setState({ backend });
  },

  render() {
    var actions = [{ name: 'runSimulation', label: 'Run Simulation', icon: '' }],
      serverForm;

    switch (this.state.serverType) {
      case 'EC2':
        serverForm = <RunEC2 contents={this.state.EC2} onChange={this.dataChange} />;
        break;
      case 'Traditional':
        serverForm = <RunCluster contents={this.state.Traditional} onChange={this.dataChange} />;
        break;
      case 'OpenStack':
        serverForm = <RunOpenStack />;
        break;
      default:
        serverForm = <span>no valid serverType: {this.state.serverType}</span>;
    }

    let profiles = { cuda: false, openmp: [], opencl: [] };
    if (this.state.serverType === 'Traditional') {
      const clusterId = this.state.Traditional.profile;
      if (this.props.tradClusters[clusterId] && this.props.tradClusters[clusterId].config && this.props.tradClusters[clusterId].config.pyfr) {
        profiles = this.props.tradClusters[clusterId].config.pyfr;
      }
    }

    return (
      <div>
          <section className={formStyle.group}>
              <label className={formStyle.label}>Server Type</label>
              <select
                className={formStyle.input}
                value={this.state.serverType}
                onChange={ this.updateServerType }
              >
                <option value="Traditional">Traditional</option>
                <option value="EC2">EC2</option>
                <option value="OpenStack">OpenStack</option>
              </select>
          </section>
          <section>
              {serverForm}
          </section>
          <RuntimeBackend profiles={profiles} onChange={ this.updateBakend } visible={this.state.serverType === 'Traditional'} />
          <ButtonBar
            visible={this.state[this.state.serverType].profile !== ''}
            onAction={this.formAction}
            actions={actions}
            error={ this.props.error || this.state.error }
          />
      </div>);
  },
});

// Binding --------------------------------------------------------------------
/* eslint-disable arrow-body-style */

export default connect(
  state => {
    return {
      error: get(state, 'network.error.create_taskflow.resp.data.message')
        || get(state, 'network.error.start_taskflow.resp.data.message'),
      ec2Clusters: state.preferences.aws.mapById,
      tradClusters: state.preferences.clusters.mapById,
    };
  },
  () => {
    return {
      onRun: (taskflowName, primaryJob, payload, simulationStep, location) =>
        dispatch(Actions.createTaskflow(taskflowName, primaryJob, payload, simulationStep, location)),
    };
  }
)(SimulationStart);

