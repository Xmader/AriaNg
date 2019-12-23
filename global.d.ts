
import { PluginsCore } from "aria-ng-gui-plugins-core"

declare global {
    interface Window {
        PluginsHelper: PluginsCore
    }
}
