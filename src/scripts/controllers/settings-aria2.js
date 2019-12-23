(function () {
    'use strict';

    angular.module('ariaNg').controller('Aria2SettingsController', ['$rootScope', '$scope', '$location', 'ariaNgConstants', 'ariaNgLocalizationService', 'aria2SettingService', 'ariaNgSettingService', function ($rootScope, $scope, $location, ariaNgConstants, ariaNgLocalizationService, aria2SettingService, ariaNgSettingService) {
        var location = $location.path().substring($location.path().lastIndexOf('/') + 1);

        var isLocalhost = function () {
            var rpcHost = ariaNgSettingService.getAllRpcSettings()[0].rpcHost
            return rpcHost === "127.0.0.1" || rpcHost === "localhost" || rpcHost === "::1"
        }

        $scope.context = {
            availableOptions: (function (type) {
                var keys = aria2SettingService.getAvailableGlobalOptionsKeys(type);

                if (!keys) {
                    ariaNgLocalizationService.showError('Type is illegal!');
                    return;
                }

                return aria2SettingService.getSpecifiedOptions(keys);
            })(location),
            globalOptions: []
        };

        $scope.setGlobalOption = function (key, value, optionStatus) {
            return aria2SettingService.setGlobalOption(key, value, function (response) {
                if (response.success && response.data === 'OK') {
                    if (isLocalhost() && window.PluginsHelper) {
                        window.PluginsHelper.emit("aria2-config-changed", response.context.options)
                    }

                    optionStatus.setSuccess();
                } else {
                    optionStatus.setFailed(response.data.message);
                }
            }, true);
        };

        $rootScope.loadPromise = (function () {
            return aria2SettingService.getGlobalOption(function (response) {
                if (response.success) {
                    $scope.context.globalOptions = response.data;
                }
            });
        })();
    }]);
}());
