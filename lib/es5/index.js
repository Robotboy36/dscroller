// import Scroller from './Scroller';

(function () {

var MIN_INDICATOR_SIZE = 8;
var win = typeof window !== 'undefined' ? window : undefined;

if (!win) {
  win = typeof global !== 'undefined' ? global : {};
}

function setTransform(nodeStyle, value) {
  nodeStyle.transform = value;
  nodeStyle.webkitTransform = value;
  nodeStyle.MozTransform = value;
}

function setTransformOrigin(nodeStyle, value) {
  nodeStyle.transformOrigin = value;
  nodeStyle.webkitTransformOrigin = value;
  nodeStyle.MozTransformOrigin = value;
}

var supportsPassive = false;
try {
  var opts = Object.defineProperty({}, 'passive', {
    get() {
      supportsPassive = true;
    },
  });
  win.addEventListener('test', null, opts);
} catch (e) {
  // empty
}

var isWebView = typeof navigator !== 'undefined' &&
  /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(navigator.userAgent);

function iOSWebViewFix(e, touchendFn) {
  // https://github.com/ant-design/ant-design-mobile/issues/573#issuecomment-339560829
  // iOS UIWebView issue, It seems no problem in WKWebView
  if (isWebView && e.changedTouches[0].clientY < 0) {
    touchendFn(new Event('touchend') || e);
  }
}

var willPreventDefault = supportsPassive ? { passive: false } : false;
var willNotPreventDefault = supportsPassive ? { passive: true } : false;

function addEventListener(target, type, fn, options) {
  target.addEventListener(type, fn, options);
  return function () {
    target.removeEventListener(type, fn, options);
  };
}

function DOMScroller(content, options) {
  options = options || {};

  var scrollbars;
  var indicators;
  var indicatorsSize;
  var scrollbarsSize;
  var indicatorsPos;
  var scrollbarsOpacity;
  var contentSize;
  var clientSize;

  this.content = content;
  var container = this.container = content.parentNode;
  var _this = this;

  this.options = clone(options, {
    scrollingComplete: function () {
      _this.clearScrollbarTimer();
      _this.timer = setTimeout(function () {
        if (_this._destroyed) {
          return;
        }
        var pos = _this.scroller.getValues();
        if (options.onComplete) {
          options.onComplete(pos);
        }
        if (scrollbars) {
          ['x', 'y'].forEach(function (k) {
            if (scrollbars[k]) {
              _this.setScrollbarOpacity(k, 0);
            }
          });
        }
      }, 0);
    },
  });

  if (this.options.scrollbars) {
    scrollbars = this.scrollbars = {};
    indicators = this.indicators = {};
    indicatorsSize = this.indicatorsSize = {};
    scrollbarsSize = this.scrollbarsSize = {};
    indicatorsPos = this.indicatorsPos = {};
    scrollbarsOpacity = this.scrollbarsOpacity = {};
    contentSize = this.contentSize = {};
    clientSize = this.clientSize = {};

    ['x', 'y'].forEach(function (k) {
      var optionName = k === 'x' ? 'scrollingX' : 'scrollingY';
      if (_this.options[optionName] !== false) {
        scrollbars[k] = document.createElement('div');
        scrollbars[k].className = `zscroller-scrollbar-${k}`;
        indicators[k] = document.createElement('div');
        indicators[k].className = `zscroller-indicator-${k}`;
        scrollbars[k].appendChild(indicators[k]);
        indicatorsSize[k] = -1;
        scrollbarsOpacity[k] = 0;
        indicatorsPos[k] = 0;
        container.appendChild(scrollbars[k]);
      }
    });
  }

  var init = true;
  var contentStyle = content.style;

  // create Scroller instance
  this.scroller = new Scroller(function (left, top, zoom) {
    if (!init && options.onScroll) {
      options.onScroll(left, top, zoom);
    }
    setTransform(contentStyle, `translate3d(${-left}px,${-top}px,0) scale(${zoom})`);

    // var _this = this;
    if (scrollbars) {
      ['x', 'y'].forEach(function (k) {
        if (scrollbars[k]) {
          var pos = k === 'x' ? left : top;
          if (clientSize[k] >= contentSize[k]) {
            _this.setScrollbarOpacity(k, 0);
          } else {
            if (!init) {
              _this.setScrollbarOpacity(k, 1);
            }
            var normalIndicatorSize = clientSize[k] / contentSize[k] * scrollbarsSize[k];
            var size = normalIndicatorSize;
            var indicatorPos;
            if (pos < 0) {
              size = Math.max(normalIndicatorSize + pos, MIN_INDICATOR_SIZE);
              indicatorPos = 0;
            } else if (pos > (contentSize[k] - clientSize[k])) {
              size = Math.max(normalIndicatorSize + contentSize[k] - clientSize[k] - pos,
                MIN_INDICATOR_SIZE);
              indicatorPos = scrollbarsSize[k] - size;
            } else {
              indicatorPos = pos / contentSize[k] * scrollbarsSize[k];
            }
            _this.setIndicatorSize(k, size);
            _this.setIndicatorPos(k, indicatorPos);
          }
        }
      });
    }
    init = false;
  }, this.options);

  // bind events
  this.bindEvents();

  // the content element needs a correct transform origin for zooming
  setTransformOrigin(content.style, 'left top');

  // reflow for the first time
  this.reflow();
}

DOMScroller.prototype = {
  constructor: DOMScroller,
  setDisabled(disabled) {
    this.disabled = disabled;
  },
  clearScrollbarTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  },
  setScrollbarOpacity(axis, opacity) {
    if (this.scrollbarsOpacity[axis] !== opacity) {
      this.scrollbars[axis].style.opacity = opacity;
      this.scrollbarsOpacity[axis] = opacity;
    }
  },
  setIndicatorPos(axis, value) {
    var { indicatorsPos, indicators } = this;
    if (indicatorsPos[axis] !== value) {
      if (axis === 'x') {
        setTransform(indicators[axis].style, `translate3d(${value}px,0,0)`);
      } else {
        setTransform(indicators[axis].style, `translate3d(0, ${value}px,0)`);
      }
      indicatorsPos[axis] = value;
    }
  },
  setIndicatorSize(axis, value) {
    var { indicatorsSize, indicators } = this;
    if (indicatorsSize[axis] !== value) {
      indicators[axis].style[axis === 'x' ? 'width' : 'height'] = `${value}px`;
      indicatorsSize[axis] = value;
    }
  },
  reflow() {
    // var {
    //   container, content,
    //   scrollbarsSize, contentSize,
    //   scrollbars, clientSize,
    //   scroller,
    // } = this;
    var container = this.container;
    var content = this.content;
    var scrollbarsSize = this.scrollbarsSize;
    var contentSize = this.contentSize;
    var scrollbars = this.scrollbars;
    var clientSize = this.clientSize;
    var scroller = this.scroller;

    if (scrollbars) {
      contentSize.x = content.offsetWidth;
      contentSize.y = content.offsetHeight;
      clientSize.x = container.clientWidth;
      clientSize.y = container.clientHeight;
      if (scrollbars.x) {
        scrollbarsSize.x = scrollbars.x.offsetWidth;
      }
      if (scrollbars.y) {
        scrollbarsSize.y = scrollbars.y.offsetHeight;
      }
    }
    // set the right scroller dimensions
    scroller.setDimensions(
      container.clientWidth, container.clientHeight,
      content.offsetWidth, content.offsetHeight
    );

    // refresh the position for zooming purposes
    var rect = container.getBoundingClientRect();
    scroller.setPosition(rect.x + container.clientLeft, rect.y + container.clientTop);
  },
  destroy() {
    this._destroyed = true;
    this.unbindEvent();
  },
  unbindEvent(type) {
    var { eventHandlers } = this;
    if (type) {
      if (eventHandlers[type]) {
        eventHandlers[type]();
        delete eventHandlers[type];
      }
    } else {
      Object.keys(eventHandlers).forEach(function (t) {
        eventHandlers[t]();
        delete eventHandlers[t];
      });
    }
  },
  bindEvent(target, type, fn, options) {
    var { eventHandlers } = this;
    if (eventHandlers[type]) {
      eventHandlers[type]();
    }
    eventHandlers[type] = addEventListener(target, type, fn, options);
  },
  bindEvents() {
    var _this = this;
    // reflow handling
    this.eventHandlers = {};

    this.bindEvent(win, 'resize', function () {
      _this.reflow();
    }, false);

    var lockMouse = false;
    var releaseLockTimer;

    var { container, scroller } = this;

    this.bindEvent(container, 'touchstart', function (e) {
      lockMouse = true;
      if (releaseLockTimer) {
        clearTimeout(releaseLockTimer);
        releaseLockTimer = null;
      }
      // Don't react if initial down happens on a form element
      if (e.touches[0] &&
        e.touches[0].target &&
        e.touches[0].target.tagName.match(/input|textarea|select/i) ||
        _this.disabled) {
        return;
      }
      _this.clearScrollbarTimer();
      // reflow since the container may have changed
      _this.reflow();
      scroller.doTouchStart(e.touches, e.timeStamp);
    }, willNotPreventDefault);

    var { preventDefaultOnTouchMove, zooming } = this.options;
    var onTouchEnd = function (e) {
      scroller.doTouchEnd(e.timeStamp);
      releaseLockTimer = setTimeout(function () {
        lockMouse = false;
      }, 300);
    };

    if (preventDefaultOnTouchMove !== false) {
      this.bindEvent(container, 'touchmove', function (e) {
        e.preventDefault();
        scroller.doTouchMove(e.touches, e.timeStamp, e.scale);
        iOSWebViewFix(e, onTouchEnd);
      }, willPreventDefault);
    } else {
      this.bindEvent(container, 'touchmove', function (e) {
        scroller.doTouchMove(e.touches, e.timeStamp, e.scale);
        iOSWebViewFix(e, onTouchEnd);
      }, willNotPreventDefault);
    }

    this.bindEvent(container, 'touchend', onTouchEnd, willNotPreventDefault);
    this.bindEvent(container, 'touchcancel', onTouchEnd, willNotPreventDefault);

    var onMouseUp = function (e) {
      scroller.doTouchEnd(e.timeStamp);
      _this.unbindEvent('mousemove');
      _this.unbindEvent('mouseup');
    };

    var onMouseMove = function (e) {
      scroller.doTouchMove([{
        pageX: e.pageX,
        pageY: e.pageY,
      }], e.timeStamp);
    };

    this.bindEvent(container, 'mousedown', function (e) {
      if (
        lockMouse ||
        e.target.tagName.match(/input|textarea|select/i) ||
        _this.disabled
      ) {
        return;
      }
      _this.clearScrollbarTimer();
      scroller.doTouchStart([{
        pageX: e.pageX,
        pageY: e.pageY,
      }], e.timeStamp);
      // reflow since the container may have changed
      _this.reflow();
      e.preventDefault();
      _this.bindEvent(document, 'mousemove', onMouseMove, willNotPreventDefault);
      _this.bindEvent(document, 'mouseup', onMouseUp, willNotPreventDefault);
    }, willPreventDefault);

    if (zooming) {
      this.bindEvent(container, 'mousewheel', function (e) {
        scroller.doMouseZoom(e.wheelDelta, e.timeStamp, e.pageX, e.pageY);
        e.preventDefault();
      }, willPreventDefault);
    }
  },
  scrollTo (value, direction, animate) {
    direction = direction || 'y';
    animate = animate || true;

    if (direction === 'x') {
      this.scroller.scrollTo(value, 0, animate);
    }
    
    if (direction === 'y') {
      this.scroller.scrollTo(0, value, animate);
    }
  }
};


function type( param ){
  return Object.prototype.toString.call(param).slice(8, -1).toLowerCase()
}

// 是否是对象
function isObject (param) {
  return type(param) === 'object' || (param instanceof Object);
}
// 是否是数组
function isArray (param) {
  return Array.isArray(param) || type(param) === 'array';
}

// 克隆
// target: 合并后的目标对象
// source: 需要合并的对象
function clone (target, source, deep = false) {
  target = type(target) === 'undefined' ? {} : target;

  if (!deep && Object.assign) {
      return Object.assign(target, source);
  }

  for (let prop in source) {
      if (!source.hasOwnProperty(prop)) {
          continue;
      }

      let value = source[prop];
      if ( typeof value !== typeof target[prop]) {
          target[prop] = value;
          continue;
      }

      // object
      if (deep && isObject(value)) {
          !isObject(target[prop]) && (target[prop] = {});
          clone(target[prop], value, deep);

      // array
      } else if (deep && isArray(value)) {
          let tempTarget = isArray(target[prop]) ? target[prop] : [];
          //
          value.forEach((item, index) => {
              clone(tempTarget[index], item, deep);
          });
          target[prop] = tempTarget;
      // fn, element, string, number, boolean
      } else {
          target[prop] = value;
      }
  }

  return target;
}


// export default DOMScroller;
win.DOMScroller = DOMScroller;
})();
