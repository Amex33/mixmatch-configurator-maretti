import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import ConfiguratorApp from './configurator/ConfiguratorApp';
import { setApiBase } from './configurator/stores/configuratorStore';

// Op maretti.com/configurator zet de Magento CMS-pagina: <div id="mixmatch-configurator" data-api="https://..."></div>
const element = document.getElementById('mixmatch-configurator');

if (element) {
    setApiBase(element.dataset.api ?? '');
    createRoot(element).render(createElement(ConfiguratorApp));
}
