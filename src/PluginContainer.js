/**
 * Copyright 2018-present Facebook.
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 * @format
 */
import type {FlipperPlugin, FlipperDevicePlugin} from './plugin.js';
import type LogManager from './fb-stubs/Logger';
import BaseDevice from './devices/BaseDevice.js';
import type {Props as PluginProps} from './plugin';

import Client from './Client.js';
import {
  ErrorBoundary,
  PureComponent,
  FlexColumn,
  FlexRow,
  colors,
  styled,
} from 'flipper';
import React from 'react';
import {connect} from 'react-redux';
import {setPluginState} from './reducers/pluginStates.js';
import {selectPlugin} from './reducers/connections';
import NotificationsHub from './NotificationsHub';
import {activateMenuItems} from './MenuBar.js';

const Container = styled(FlexColumn)({
  width: 0,
  flexGrow: 1,
  flexShrink: 1,
  backgroundColor: colors.white,
});

const SidebarContainer = styled(FlexRow)({
  backgroundColor: colors.light02,
  height: '100%',
  overflow: 'scroll',
});

type Props = {
  logger: LogManager,
  pluginState: Object,
  activePlugin: ?Class<FlipperPlugin<> | FlipperDevicePlugin<>>,
  target: Client | BaseDevice | null,
  pluginKey: string,
  deepLinkPayload: ?string,

  selectPlugin: (payload: {|
    selectedPlugin: ?string,
    selectedApp?: ?string,
    deepLinkPayload: ?string,
  |}) => mixed,
  setPluginState: (payload: {
    pluginKey: string,
    state: Object,
  }) => void,
};

class PluginContainer extends PureComponent<Props> {
  plugin: ?FlipperPlugin<> | FlipperDevicePlugin<>;

  refChanged = (ref: ?FlipperPlugin<> | FlipperDevicePlugin<>) => {
    if (this.plugin) {
      this.plugin._teardown();
      this.plugin = null;
    }
    if (ref && this.props.target) {
      activateMenuItems(ref);
      ref._init();
      this.props.logger.trackTimeSince(`activePlugin-${ref.constructor.id}`);
      this.plugin = ref;
    }
  };

  render() {
    const {
      pluginState,
      setPluginState,
      activePlugin,
      pluginKey,
      target,
    } = this.props;

    if (!activePlugin || !target) {
      return null;
    }
    const props: PluginProps<Object> = {
      key: pluginKey,
      logger: this.props.logger,
      persistedState: activePlugin.defaultPersistedState
        ? {
            ...activePlugin.defaultPersistedState,
            ...pluginState,
          }
        : pluginState,
      setPersistedState: state => setPluginState({pluginKey, state}),
      target,
      deepLinkPayload: this.props.deepLinkPayload,
      selectPlugin: (pluginID: string, deepLinkPayload: ?string) => {
        const {target} = this.props;
        // check if plugin will be available
        if (
          target instanceof Client &&
          target.plugins.some(p => p === pluginID)
        ) {
          this.props.selectPlugin({selectedPlugin: pluginID, deepLinkPayload});
          return true;
        } else if (target instanceof BaseDevice) {
          this.props.selectPlugin({selectedPlugin: pluginID, deepLinkPayload});
          return true;
        } else {
          return false;
        }
      },
      ref: this.refChanged,
    };

    return (
      <React.Fragment>
        <Container key="plugin">
          <ErrorBoundary
            heading={`Plugin "${
              activePlugin.title
            }" encountered an error during render`}
            logger={this.props.logger}>
            {React.createElement(activePlugin, props)}
          </ErrorBoundary>
        </Container>
        <SidebarContainer id="detailsSidebar" />
      </React.Fragment>
    );
  }
}

/* $FlowFixMe(>=0.86.0) This
 * comment suppresses an error found when Flow v0.86 was
 * deployed. To see the error, delete this comment and
 * run Flow. */
export default connect(
  ({
    application: {rightSidebarVisible, rightSidebarAvailable},
    connections: {
      selectedPlugin,
      selectedDevice,
      selectedApp,
      clients,
      deepLinkPayload,
    },
    pluginStates,
    plugins: {devicePlugins, clientPlugins},
  }) => {
    let pluginKey = 'unknown';
    let target = null;
    let activePlugin: ?Class<FlipperPlugin<> | FlipperDevicePlugin<>> = null;

    if (selectedPlugin) {
      if (selectedPlugin === NotificationsHub.id) {
        activePlugin = NotificationsHub;
      } else if (selectedPlugin) {
        activePlugin = devicePlugins.get(selectedPlugin);
      }
      target = selectedDevice;
      if (activePlugin) {
        pluginKey = `${selectedDevice.serial}#${activePlugin.id}`;
      } else {
        target = clients.find((client: Client) => client.id === selectedApp);
        activePlugin = clientPlugins.get(selectedPlugin);
        if (!activePlugin || !target) {
          throw new Error(
            `Plugin "${selectedPlugin || ''}" could not be found.`,
          );
        }
        pluginKey = `${target.id}#${activePlugin.id}`;
      }
    }

    return {
      pluginState: pluginStates[pluginKey],
      activePlugin,
      target,
      deepLinkPayload,
      pluginKey,
    };
  },
  {
    setPluginState,
    selectPlugin,
  },
)(PluginContainer);
