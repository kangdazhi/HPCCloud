#!/usr/bin/env python
# -*- coding: utf-8 -*-

###############################################################################
#  Copyright 2016 Kitware Inc.
#
#  Licensed under the Apache License, Version 2.0 ( the "License" );
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
###############################################################################

import jsonschema

from girder.models.model_base import AccessControlledModel, ValidationException
from girder.constants import AccessType

from ..utility import share_folder, to_object_id, get_simulations_folder
import schema


class Simulation(AccessControlledModel):

    def __init__(self):
        super(Simulation, self).__init__()

    def initialize(self):
        self.name = 'simulations'

    def validate(self, simulation):
        """
        Validate using jsonschema
        """
        try:
            ref_resolver = jsonschema.RefResolver.from_schema(
                schema.definitions)
            jsonschema.validate(
                simulation, schema.simulation, resolver=ref_resolver)
        except jsonschema.ValidationError as ve:
            raise ValidationException(ve.message)

        return simulation

    def create(self, user, project, simulation, create_step_folders=True):
        """
        Create a simulation.

        :param user: The user creating the simulation.
        :param project: The project this simulation is associated with.
        :param simulation: The simulation object
        """
        simulation['projectId'] = project['_id']
        simulation['userId'] = user['_id']

        # validate first, so we know we have the properties we need
        self.validate(simulation)

        simulations_folder = get_simulations_folder(user, project)

        simulation_folder = self.model('folder').createFolder(
            simulations_folder, simulation['name'], parentType='folder',
            creator=user)

        simulation['folderId'] = simulation_folder['_id']
        # Set the status of all the steps to 'created' and create the folders
        # for each step
        for name, step in simulation['steps'].iteritems():
            step['status'] = 'created'
            if create_step_folders:
                step_folder = self.model('folder').createFolder(
                    simulation_folder, name, parentType='folder',
                    creator=user)
                step['folderId'] = step_folder['_id']

        simulation = self.setUserAccess(
            simulation, user=user, level=AccessType.ADMIN)

        return self.save(simulation)

    def delete(self, user, simulation):
        """
        Delete a simulation.

        :param user: The user deleting the simulation.
        :param simulation: The simulation to be deleted
        """

        # Load the simulation folder
        simulation_folder = self.model('folder').load(
            simulation['folderId'], user=user)

        self.remove(simulation)
        self.model('folder').remove(simulation_folder)

    def update(self, user, simulation, name):
        """
        Update a simulation.

        :param user: The user updating the simulation.
        :param simulation: The simulation to be deleted
        :param name: The new simulation name
        """
        if name:
            simulation['name'] = name

        return self.save(simulation)

    def clone(self, user, simulation, name):
        """
        Clone a simulation. Copied over input steps, but rest output steps. To
        'created'.

        :param user: The user cloning the simulation.
        :param simulation: The simulation to be clone
        :param name: The cloned simulation name
        """
        project = self.model('project', 'hpccloud').load(
            simulation['projectId'], user=user, level=AccessType.READ)

        del simulation['_id']
        simulation['name'] = name

        cloned_simulation = self.create(
            user, project, simulation, create_step_folders=False)
        simulation_folder = self.model('folder').load(
            cloned_simulation['folderId'], user=user, level=AccessType.READ)

        for name, step in cloned_simulation['steps'].iteritems():
            if step['type'] == 'input':
                step_folder = self.model('folder').load(
                    step['folderId'], user=user, level=AccessType.READ)
                copied_folder = self.model('folder').copyFolder(
                    step_folder, parent=simulation_folder, name=name,
                    parentType='folder', creator=user)
                step['folderId'] = copied_folder['_id']
                step['status'] = simulation['steps'][name]['status']
            elif step['type'] == 'output':
                # Just create a new folder
                created_folder = self.model('folder').createFolder(
                    simulation_folder, name, parentType='folder', creator=user)
                step['folderId'] = created_folder['_id']
                if 'metatdata' in step:
                    del step['metadata']

        cloned_simulations = self.save(cloned_simulation)

        return cloned_simulations

    def share(self, sharer, simulation, users, groups):
        """
        Share a simulation.

        :param user: The user sharing the simulation.
        :param simulation: The simulation to be shared
        :param users: The users to share with.
        :param groups: The groups to share with.
        """
        access_list = simulation['access']
        access_list['users'] \
            = [user for user in access_list['users'] if user != sharer['_id']]
        access_list['groups'] = []

        for user_id in users:
            access_object = {
                'id': to_object_id(user_id),
                'level': AccessType.READ
            }
            access_list['users'].append(access_object)

        for group_id in groups:
            access_object = {
                'id': to_object_id(group_id),
                'level': AccessType.READ
            }
            access_list['groups'].append(access_object)

        # Share the simulation folder
        simulation_folder = self.model('folder').load(
            simulation['folderId'], user=sharer)

        share_folder(sharer, simulation_folder, users, groups)

        return self.save(simulation)

    def update_step(self, user, simulation, step_name, status, metadata,
                    export):
        """
        Update a simulation step.

        :param user: The user updating the simulation.
        :param simulation: The simulation to be updated.
        :param step_name: The name of the step to be updated.
        :param status: The new status.
        :param metadata: The new metadata object.
        :param export: The new export object.
        """
        step = simulation['steps'][step_name]
        dirty = False
        if status is not None:
            step['status'] = status
            dirty = True

        if metadata is not None:
            step['metadata'] = metadata
            dirty = True

        if export is not None:
            step['export'] = export
            dirty = True

        if dirty:
            self.save(simulation)
