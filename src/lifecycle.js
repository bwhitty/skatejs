'use strict';

import {
  ATTR_IGNORE
} from './constants';
import data from './data';
import MutationObserver from './mutation-observer';
import registry from './registry';
import {
  camelCase,
  elementContains,
  hasOwn,
  inherit,
  objEach
} from './utils';

var elProto = window.HTMLElement.prototype;
var nativeMatchesSelector = (
  elProto.matches ||
  elProto.msMatchesSelector ||
  elProto.webkitMatchesSelector ||
  elProto.mozMatchesSelector ||
  elProto.oMatchesSelector
);

// Only IE9 has this msMatchesSelector bug, but best to detect it.
var hasNativeMatchesSelectorDetattachedBug = !nativeMatchesSelector.call(document.createElement('div'), 'div');
var matchesSelector = function (element, selector) {
  if (hasNativeMatchesSelectorDetattachedBug) {
    var clone = element.cloneNode();
    document.createElement('div').appendChild(clone);
    return nativeMatchesSelector.call(clone, selector);
  }
  return nativeMatchesSelector.call(element, selector);
};

/**
 * Parses an event definition and returns information about it.
 *
 * @param {String} e The event to parse.
 *
 * @returns {Object]}
 */
function parseEvent (e) {
  var parts = e.split(' ');
  return {
    name: parts.shift(),
    delegate: parts.join(' ')
  };
}

/**
 * Sets the defined attributes to their default values, if specified.
 *
 * @param {Element} target The web component element.
 * @param {Object} component The web component definition.
 *
 * @returns {undefined}
 */
function initAttributes (target, component) {
  var componentAttributes = component.attributes;

  if (typeof componentAttributes !== 'object') {
    return;
  }

  for (var attribute in componentAttributes) {
    if (hasOwn(componentAttributes, attribute) && hasOwn(componentAttributes[attribute], 'value') && !target.hasAttribute(attribute)) {
      var value = componentAttributes[attribute].value;
      value = typeof value === 'function' ? value(target) : value;
      target.setAttribute(attribute, value);
    }
  }
}

/**
 * Defines a property that proxies the specified attribute.
 *
 * @param {Element} target The web component element.
 * @param {String} attribute The attribute name to proxy.
 *
 * @returns {undefined}
 */
function defineAttributeProperty (target, attribute) {
  Object.defineProperty(target, camelCase(attribute), {
    get: function () {
      return this.getAttribute(attribute);
    },
    set: function (value) {
      if (value === undefined) {
        this.removeAttribute(attribute);
      } else {
        this.setAttribute(attribute, value);
      }
    }
  });
}

/**
 * Adds links from attributes to properties.
 *
 * @param {Element} target The web component element.
 * @param {Object} component The web component definition.
 *
 * @returns {undefined}
 */
function addAttributeToPropertyLinks (target, component) {
  var componentAttributes = component.attributes;

  if (typeof componentAttributes !== 'object') {
    return;
  }

  for (var attribute in componentAttributes) {
    if (hasOwn(componentAttributes, attribute) && !hasOwn(target, attribute)) {
      defineAttributeProperty(target, attribute);
    }
  }
}

function triggerAttributeChanged(target, component, data) {
  var callback;
  var type;
  var name = data.name;
  var newValue = data.newValue;
  var oldValue = data.oldValue;
  var newValueIsString = typeof newValue === 'string';
  var oldValueIsString = typeof oldValue === 'string';
  var attrs = component.attributes;
  var specific = attrs && attrs[name];

  if (!oldValueIsString && newValueIsString) {
    type = 'created';
  } else if (oldValueIsString && newValueIsString) {
    type = 'updated';
  } else if (oldValueIsString && !newValueIsString) {
    type = 'removed';
  }

  if (specific && typeof specific[type] === 'function') {
    callback = specific[type];
  } else if (specific && typeof specific.fallback === 'function') {
    callback = specific.fallback;
  } else if (typeof specific === 'function') {
    callback = specific;
  } else if (typeof attrs === 'function') {
    callback = attrs;
  }

  // Ensure values are null if undefined.
  newValue = newValue === undefined ? null : newValue;
  oldValue = oldValue === undefined ? null : oldValue;

  // There may still not be a callback.
  if (callback) {
    callback(target, {
      type: type,
      name: name,
      newValue: newValue,
      oldValue: oldValue
    });
  }
}

function triggerAttributesCreated (target, component) {
  var a;
  var attrs = target.attributes;
  var attrsCopy = [];
  var attrsLen = attrs.length;

  for (a = 0; a < attrsLen; a++) {
    attrsCopy.push(attrs[a]);
  }

  // In default web components, attribute changes aren't triggered for
  // attributes that already exist on an element when it is bound. This sucks
  // when you want to reuse and separate code for attributes away from your
  // lifecycle callbacks. Skate will initialise each attribute by calling the
  // created callback for the attributes that already exist on the element.
  for (a = 0; a < attrsLen; a++) {
    var attr = attrsCopy[a];
    triggerAttributeChanged(target, component, {
      name: attr.nodeName,
      newValue: attr.value || attr.nodeValue
    });
  }
}

function addAttributeListeners (target, component) {
  var attrs = target.attributes;

  if (!component.attributes || registry.isNativeCustomElement(component.id)) {
    return;
  }

  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      var name = mutation.attributeName;
      var attr = attrs[name];

      triggerAttributeChanged(target, component, {
        name: name,
        newValue: attr && (attr.value || attr.nodeValue),
        oldValue: mutation.oldValue
      });
    });
  });

  observer.observe(target, {
    attributes: true,
    attributeOldValue: true
  });
}

/**
 * Binds event listeners for the specified event handlers.
 *
 * @param {Element} target The component element.
 * @param {Object} component The component data.
 *
 * @returns {undefined}
 */
function addEventListeners (target, component) {
  if (typeof component.events !== 'object') {
    return;
  }

  function makeHandler (handler, delegate) {
    return function (e) {
      // If we're not delegating, trigger directly on the component element.
      if (!delegate) {
        return handler(target, e, target);
      }

      // If we're delegating, but the target doesn't match, then we've have
      // to go up the tree until we find a matching ancestor or stop at the
      // component element, or document. If a matching ancestor is found, the
      // handler is triggered on it.
      var current = e.target;

      while (current && current !== document && current !== target.parentNode) {
        if (matchesSelector(current, delegate)) {
          return handler(target, e, current);
        }

        current = current.parentNode;
      }
    };
  }

  objEach(component.events, function (handler, name) {
    var evt = parseEvent(name);
    var useCapture = !!evt.delegate && (evt.name === 'blur' || evt.name === 'focus');
    target.addEventListener(evt.name, makeHandler(handler, evt.delegate), useCapture);
  });
}

/**
 * Triggers the created lifecycle callback.
 *
 * @param {Element} target The component element.
 * @param {Object} component The component data.
 *
 * @returns {undefined}
 */
function triggerCreated (target, component) {
  var targetData = data(target, component.id);

  if (targetData.created) {
    return;
  }

  targetData.created = true;

  // TODO: This doesn't need to happen if using native.
  inherit(target, component.prototype, true);

  // We use the unresolved / resolved attributes to flag whether or not the
  // element has been templated or not.
  if (component.template && !target.hasAttribute(component.resolvedAttribute)) {
    component.template(target);
  }

  target.removeAttribute(component.unresolvedAttribute);
  target.setAttribute(component.resolvedAttribute, '');
  addEventListeners(target, component);
  addAttributeListeners(target, component);
  addAttributeToPropertyLinks(target, component);
  initAttributes(target, component);
  triggerAttributesCreated(target, component);

  if (component.created) {
    component.created(target);
  }
}

/**
 * Triggers the attached lifecycle callback.
 *
 * @param {Element} target The component element.
 * @param {Object} component The component data.
 *
 * @returns {undefined}
 */
function triggerAttached (target, component) {
  var targetData = data(target, component.id);

  if (targetData.attached) {
    return;
  }

  targetData.attached = true;

  if (component.attached) {
    component.attached(target);
  }

  targetData.detached = false;
}

/**
 * Triggers the detached lifecycle callback.
 *
 * @param {Element} target The component element.
 * @param {Object} component The component data.
 *
 * @returns {undefined}
 */
function triggerDetached (target, component) {
  var targetData = data(target, component.id);

  if (targetData.detached) {
    return;
  }

  targetData.detached = true;

  if (component.detached) {
    component.detached(target);
  }

  targetData.attached = false;
}

/**
 * Creates a tree-walker pre-configured for walking a tree for only nodes that
 * Skate cares about.
 *
 * @param {DOMElement} element The element to walk.
 *
 * @returns {TreeWalker}
 */
function createTreeWalker (element) {
  return document.createTreeWalker(
    element,
    NodeFilter.SHOW_ELEMENT,
    function (node) {
      // If ignoring this node we must ensure that it's we flag it so that as
      // the tree walker goes down the tree it only needs to check if its parent
      // is ignored.
      if (node.attributes && node.attributes[ATTR_IGNORE]) {
        data(node).ignored = true;
        return false;
      }

      // If the parent is ignored, then this node is ignored, too.
      if (data(node.parentNode).ignored) {
        data(node).ignored = true;
        return false;
      }

      return true;
    },
    true
  );
}

/**
 * Initialises a set of elements.
 *
 * @param {DOMNodeList | Array} elements A traversable set of elements.
 *
 * @returns {undefined}
 */
function initElements (elements) {
  var a, b, c, d, e;
  var definitions;
  var definitionsLength;
  var element;
  var elementsLength;
  var elementsList;
  var elementsListLength;
  var elementsListDefinitions;
  var elementWalker;
  var elementWalkerCurrentNode;

  elementsList = [];
  elementsListDefinitions = [];
  elementsLength = elements.length;

  // Build a list of nodes that we will initialise.
  for (a = 0; a < elementsLength; a++) {
    element = elements[a];

    // We screen the root node only. The rest of the nodes are screened in the
    // tree walker.
    if (element.nodeType !== 1 || element.attributes[ATTR_IGNORE]) {
      continue;
    }

    elementWalker = createTreeWalker(element);
    elementsList.push(element);
    elementsListDefinitions.push(registry.getForElement(element));

    while (elementWalker.nextNode()) {
      elementWalkerCurrentNode = elementWalker.currentNode;
      elementsList.push(elementWalkerCurrentNode);
      elementsListDefinitions.push(registry.getForElement(elementWalkerCurrentNode));
    }
  }

  // Triggering all created before all attached mimics the behaviour of native
  // custom elements.
  elementsListLength = elementsList.length;

  // Trigger all created callbacks first.
  for (b = 0; b < elementsListLength; b++) {
    definitions = elementsListDefinitions[b];
    definitionsLength = definitions.length;
    element = elementsList[b];

    for (c = 0; c < definitionsLength; c++) {
      triggerCreated(element, definitions[c]);
    }
  }

  // Then trigger the attached callbacks.
  for (d = 0; d < elementsListLength; d++) {
    definitions = elementsListDefinitions[d];
    definitionsLength = definitions.length;
    element = elementsList[d];

    for (e = 0; e < definitionsLength; e++) {
      if (elementContains(document, element)) {
        triggerAttached(element, definitions[e]);
      }
    }
  }
}

/**
 * Triggers the remove lifecycle callback on all of the elements.
 *
 * @param {DOMNodeList} elements The elements to trigger the remove lifecycle
 * callback on.
 *
 * @returns {undefined}
 */
function removeElements (elements) {
  var len = elements.length;

  for (var a = 0; a < len; a++) {
    var element = elements[a];

    if (element.nodeType !== 1) {
      continue;
    }

    removeElements(element.childNodes);

    var definitions = registry.getForElement(element);
    var definitionsLen = definitions.length;

    for (var b = 0; b < definitionsLen; b++) {
      triggerDetached(element, definitions[b]);
    }
  }
}

export {
  initElements,
  removeElements,
  triggerAttached,
  triggerAttributeChanged,
  triggerCreated,
  triggerDetached
};
