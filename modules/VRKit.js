/* Built for whs v2.1.8-vrfix.1 */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('whs'), require('three')) :
	typeof define === 'function' && define.amd ? define(['exports', 'whs', 'three'], factory) :
	(factory((global.VRKit = global.VRKit || {}),global.WHS,global.THREE));
}(this, (function (exports,whs,three) { 'use strict';

/**
 * @author dmarcos / https://github.com/dmarcos
 * @author mrdoob / http://mrdoob.com
 *
 * WebVR Spec: http://mozvr.github.io/webvr-spec/webvr.html
 *
 * Firefox: http://mozvr.com/downloads/
 * Chromium: https://webvr.info/get-chrome
 *
 */

var VREffect = function VREffect(renderer, onError) {

	var vrDisplay, vrDisplays;
	var eyeTranslationL = new THREE.Vector3();
	var eyeTranslationR = new THREE.Vector3();
	var renderRectL, renderRectR;

	var frameData = null;

	if ('VRFrameData' in window) {

		frameData = new VRFrameData();
	}

	function gotVRDisplays(displays) {

		vrDisplays = displays;

		if (displays.length > 0) {

			vrDisplay = displays[0];
		} else {

			if (onError) onError('HMD not available');
		}
	}

	if (navigator.getVRDisplays) {

		navigator.getVRDisplays().then(gotVRDisplays).catch(function () {

			console.warn('THREE.VREffect: Unable to get VR Displays');
		});
	}

	//

	this.isPresenting = false;
	this.scale = 1;

	var scope = this;

	var rendererSize = renderer.getSize();
	var rendererUpdateStyle = false;
	var rendererPixelRatio = renderer.getPixelRatio();

	this.getVRDisplay = function () {

		return vrDisplay;
	};

	this.setVRDisplay = function (value) {

		vrDisplay = value;
	};

	this.getVRDisplays = function () {

		console.warn('THREE.VREffect: getVRDisplays() is being deprecated.');
		return vrDisplays;
	};

	this.setSize = function (width, height, updateStyle) {

		rendererSize = { width: width, height: height };
		rendererUpdateStyle = updateStyle;

		if (scope.isPresenting) {

			var eyeParamsL = vrDisplay.getEyeParameters('left');
			renderer.setPixelRatio(1);
			renderer.setSize(eyeParamsL.renderWidth * 2, eyeParamsL.renderHeight, false);
		} else {

			renderer.setPixelRatio(rendererPixelRatio);
			renderer.setSize(width, height, updateStyle);
		}
	};

	// fullscreen

	var canvas = renderer.domElement;
	var requestFullscreen;
	var exitFullscreen;
	var fullscreenElement;
	var defaultLeftBounds = [0.0, 0.0, 0.5, 1.0];
	var defaultRightBounds = [0.5, 0.0, 0.5, 1.0];

	function onVRDisplayPresentChange() {

		var wasPresenting = scope.isPresenting;
		scope.isPresenting = vrDisplay !== undefined && vrDisplay.isPresenting;

		if (scope.isPresenting) {

			var eyeParamsL = vrDisplay.getEyeParameters('left');
			var eyeWidth = eyeParamsL.renderWidth;
			var eyeHeight = eyeParamsL.renderHeight;

			if (!wasPresenting) {

				rendererPixelRatio = renderer.getPixelRatio();
				rendererSize = renderer.getSize();

				renderer.setPixelRatio(1);
				renderer.setSize(eyeWidth * 2, eyeHeight, false);
			}
		} else if (wasPresenting) {

			renderer.setPixelRatio(rendererPixelRatio);
			renderer.setSize(rendererSize.width, rendererSize.height, rendererUpdateStyle);
		}
	}

	window.addEventListener('vrdisplaypresentchange', onVRDisplayPresentChange, false);

	this.setFullScreen = function (boolean) {

		return new Promise(function (resolve, reject) {

			if (vrDisplay === undefined) {

				reject(new Error('No VR hardware found.'));
				return;
			}

			if (scope.isPresenting === boolean) {

				resolve();
				return;
			}

			if (boolean) {

				resolve(vrDisplay.requestPresent([{ source: canvas }]));
			} else {

				resolve(vrDisplay.exitPresent());
			}
		});
	};

	this.requestPresent = function () {

		return this.setFullScreen(true);
	};

	this.exitPresent = function () {

		return this.setFullScreen(false);
	};

	this.requestAnimationFrame = function (f) {

		if (vrDisplay !== undefined) {

			return vrDisplay.requestAnimationFrame(f);
		} else {

			return window.requestAnimationFrame(f);
		}
	};

	this.cancelAnimationFrame = function (h) {

		if (vrDisplay !== undefined) {

			vrDisplay.cancelAnimationFrame(h);
		} else {

			window.cancelAnimationFrame(h);
		}
	};

	this.submitFrame = function () {

		if (vrDisplay !== undefined && scope.isPresenting) {

			vrDisplay.submitFrame();
		}
	};

	this.autoSubmitFrame = true;

	// render

	var cameraL = new THREE.PerspectiveCamera();
	cameraL.layers.enable(1);

	var cameraR = new THREE.PerspectiveCamera();
	cameraR.layers.enable(2);

	this.render = function (scene, camera, renderTarget, forceClear) {

		if (vrDisplay && scope.isPresenting) {

			var autoUpdate = scene.autoUpdate;

			if (autoUpdate) {

				scene.updateMatrixWorld();
				scene.autoUpdate = false;
			}

			var eyeParamsL = vrDisplay.getEyeParameters('left');
			var eyeParamsR = vrDisplay.getEyeParameters('right');

			eyeTranslationL.fromArray(eyeParamsL.offset);
			eyeTranslationR.fromArray(eyeParamsR.offset);

			if (Array.isArray(scene)) {

				console.warn('THREE.VREffect.render() no longer supports arrays. Use object.layers instead.');
				scene = scene[0];
			}

			// When rendering we don't care what the recommended size is, only what the actual size
			// of the backbuffer is.
			var size = renderer.getSize();
			var layers = vrDisplay.getLayers();
			var leftBounds;
			var rightBounds;

			if (layers.length) {

				var layer = layers[0];

				leftBounds = layer.leftBounds !== null && layer.leftBounds.length === 4 ? layer.leftBounds : defaultLeftBounds;
				rightBounds = layer.rightBounds !== null && layer.rightBounds.length === 4 ? layer.rightBounds : defaultRightBounds;
			} else {

				leftBounds = defaultLeftBounds;
				rightBounds = defaultRightBounds;
			}

			renderRectL = {
				x: Math.round(size.width * leftBounds[0]),
				y: Math.round(size.height * leftBounds[1]),
				width: Math.round(size.width * leftBounds[2]),
				height: Math.round(size.height * leftBounds[3])
			};
			renderRectR = {
				x: Math.round(size.width * rightBounds[0]),
				y: Math.round(size.height * rightBounds[1]),
				width: Math.round(size.width * rightBounds[2]),
				height: Math.round(size.height * rightBounds[3])
			};

			if (renderTarget) {

				renderer.setRenderTarget(renderTarget);
				renderTarget.scissorTest = true;
			} else {

				renderer.setRenderTarget(null);
				renderer.setScissorTest(true);
			}

			if (renderer.autoClear || forceClear) renderer.clear();

			if (camera.parent === null) camera.updateMatrixWorld();

			camera.matrixWorld.decompose(cameraL.position, cameraL.quaternion, cameraL.scale);
			camera.matrixWorld.decompose(cameraR.position, cameraR.quaternion, cameraR.scale);

			var scale = this.scale;
			cameraL.translateOnAxis(eyeTranslationL, scale);
			cameraR.translateOnAxis(eyeTranslationR, scale);

			if (vrDisplay.getFrameData) {

				vrDisplay.depthNear = camera.near;
				vrDisplay.depthFar = camera.far;

				vrDisplay.getFrameData(frameData);

				cameraL.projectionMatrix.elements = frameData.leftProjectionMatrix;
				cameraR.projectionMatrix.elements = frameData.rightProjectionMatrix;
			} else {

				cameraL.projectionMatrix = fovToProjection(eyeParamsL.fieldOfView, true, camera.near, camera.far);
				cameraR.projectionMatrix = fovToProjection(eyeParamsR.fieldOfView, true, camera.near, camera.far);
			}

			// render left eye
			if (renderTarget) {

				renderTarget.viewport.set(renderRectL.x, renderRectL.y, renderRectL.width, renderRectL.height);
				renderTarget.scissor.set(renderRectL.x, renderRectL.y, renderRectL.width, renderRectL.height);
			} else {

				renderer.setViewport(renderRectL.x, renderRectL.y, renderRectL.width, renderRectL.height);
				renderer.setScissor(renderRectL.x, renderRectL.y, renderRectL.width, renderRectL.height);
			}
			renderer.render(scene, cameraL, renderTarget, forceClear);

			// render right eye
			if (renderTarget) {

				renderTarget.viewport.set(renderRectR.x, renderRectR.y, renderRectR.width, renderRectR.height);
				renderTarget.scissor.set(renderRectR.x, renderRectR.y, renderRectR.width, renderRectR.height);
			} else {

				renderer.setViewport(renderRectR.x, renderRectR.y, renderRectR.width, renderRectR.height);
				renderer.setScissor(renderRectR.x, renderRectR.y, renderRectR.width, renderRectR.height);
			}
			renderer.render(scene, cameraR, renderTarget, forceClear);

			if (renderTarget) {

				renderTarget.viewport.set(0, 0, size.width, size.height);
				renderTarget.scissor.set(0, 0, size.width, size.height);
				renderTarget.scissorTest = false;
				renderer.setRenderTarget(null);
			} else {

				renderer.setViewport(0, 0, size.width, size.height);
				renderer.setScissorTest(false);
			}

			if (autoUpdate) {

				scene.autoUpdate = true;
			}

			if (scope.autoSubmitFrame) {

				scope.submitFrame();
			}

			return;
		}

		// Regular render mode if not HMD

		renderer.render(scene, camera, renderTarget, forceClear);
	};

	this.dispose = function () {

		window.removeEventListener('vrdisplaypresentchange', onVRDisplayPresentChange, false);
	};

	//

	function fovToNDCScaleOffset(fov) {

		var pxscale = 2.0 / (fov.leftTan + fov.rightTan);
		var pxoffset = (fov.leftTan - fov.rightTan) * pxscale * 0.5;
		var pyscale = 2.0 / (fov.upTan + fov.downTan);
		var pyoffset = (fov.upTan - fov.downTan) * pyscale * 0.5;
		return { scale: [pxscale, pyscale], offset: [pxoffset, pyoffset] };
	}

	function fovPortToProjection(fov, rightHanded, zNear, zFar) {

		rightHanded = rightHanded === undefined ? true : rightHanded;
		zNear = zNear === undefined ? 0.01 : zNear;
		zFar = zFar === undefined ? 10000.0 : zFar;

		var handednessScale = rightHanded ? -1.0 : 1.0;

		// start with an identity matrix
		var mobj = new THREE.Matrix4();
		var m = mobj.elements;

		// and with scale/offset info for normalized device coords
		var scaleAndOffset = fovToNDCScaleOffset(fov);

		// X result, map clip edges to [-w,+w]
		m[0 * 4 + 0] = scaleAndOffset.scale[0];
		m[0 * 4 + 1] = 0.0;
		m[0 * 4 + 2] = scaleAndOffset.offset[0] * handednessScale;
		m[0 * 4 + 3] = 0.0;

		// Y result, map clip edges to [-w,+w]
		// Y offset is negated because this proj matrix transforms from world coords with Y=up,
		// but the NDC scaling has Y=down (thanks D3D?)
		m[1 * 4 + 0] = 0.0;
		m[1 * 4 + 1] = scaleAndOffset.scale[1];
		m[1 * 4 + 2] = -scaleAndOffset.offset[1] * handednessScale;
		m[1 * 4 + 3] = 0.0;

		// Z result (up to the app)
		m[2 * 4 + 0] = 0.0;
		m[2 * 4 + 1] = 0.0;
		m[2 * 4 + 2] = zFar / (zNear - zFar) * -handednessScale;
		m[2 * 4 + 3] = zFar * zNear / (zNear - zFar);

		// W result (= Z in)
		m[3 * 4 + 0] = 0.0;
		m[3 * 4 + 1] = 0.0;
		m[3 * 4 + 2] = handednessScale;
		m[3 * 4 + 3] = 0.0;

		mobj.transpose();

		return mobj;
	}

	function fovToProjection(fov, rightHanded, zNear, zFar) {

		var DEG2RAD = Math.PI / 180.0;

		var fovPort = {
			upTan: Math.tan(fov.upDegrees * DEG2RAD),
			downTan: Math.tan(fov.downDegrees * DEG2RAD),
			leftTan: Math.tan(fov.leftDegrees * DEG2RAD),
			rightTan: Math.tan(fov.rightDegrees * DEG2RAD)
		};

		return fovPortToProjection(fovPort, rightHanded, zNear, zFar);
	}
};

/**
 * @author dmarcos / https://github.com/dmarcos
 * @author mrdoob / http://mrdoob.com
 * @author halvves / https://github.com/halvves (i only es6 moduled it)
 */

class VRControls$1 {
  constructor(camera, onError) {
    this.camera = camera;
    this.vrDisplay;
    this.vrDisplays;
    this.standingMatrix = new three.Matrix4();
    this.frameData = null;

    if ('VRFrameData' in window) {
      this.frameData = new VRFrameData();
    }

    if (navigator.getVRDisplays) {
      navigator
        .getVRDisplays()
        .then((displays) => {
          this.vrDisplays = displays;
          if (displays.length > 0) {
            this.vrDisplay = displays[0];
          } else {
            if (onError) onError('VR input not available.');
          }
        })
        .catch(() => {
          console.warn('VRControls: Unable to get VR Displays');
        });
    }

    // the Rift SDK returns the position in meters
    // this scale factor allows the user to define how meters
    // are converted to scene units.
    this.scale = 1;

    // If true will use "standing space" coordinate system where y=0 is the
    // floor and x=0, z=0 is the center of the room.
    this.standing = false;

    // Distance from the users eyes to the floor in meters. Used when
    // standing=true but the VRDisplay doesn't provide stageParameters.
    this.userHeight = 1.6;
  }

  getVRDisplay() {
    return this.vrDisplay;
  };

  setVRDisplay(value) {
    this.vrDisplay = value;
  };

  getVRDisplays() {
    console.warn('VRControls: getVRDisplays() is being deprecated.');
    return this.vrDisplays;
  };

  getStandingMatrix() {
    return this.standingMatrix;
  };

  update() {
    const camera = this.camera;

    if (this.vrDisplay) {
      let pose;
      if (this.vrDisplay.getFrameData) {
        this.vrDisplay.getFrameData(this.frameData);
        pose = this.frameData.pose;
      } else if (this.vrDisplay.getPose) {
        pose = this.vrDisplay.getPose();
      }
      if (pose.orientation !== null) {
        camera.quaternion.fromArray(pose.orientation);
      }
      if (pose.position !== null) {
        camera.position.fromArray(pose.position);
      } else {
        camera.position.set(0, 0, 0);
      }
      if (this.standing) {
        if (this.vrDisplay.stageParameters) {
          camera.updateMatrix();
          this.standingMatrix.fromArray(this.vrDisplay.stageParameters.sittingToStandingTransform);
          camera.applyMatrix(this.standingMatrix);
        } else {
          camera.position.setY(camera.position.y + this.userHeight);
        }
      }
      camera.position.multiplyScalar(this.scale);
    }
  };

  dispose() {
    this.vrDisplay = null;
  };
}

/**
 * @author mrdoob / http://mrdoob.com
 * @author Mugen87 / https://github.com/Mugen87
 *
 * Based on @tojiro's vr-samples-utils.js
 */

var WEBVR = {

	isAvailable: function isAvailable() {

		console.warn('WEBVR: isAvailable() is being deprecated. Use .checkAvailability() instead.');
		return navigator.getVRDisplays !== undefined;
	},

	checkAvailability: function checkAvailability() {

		return new Promise(function (resolve, reject) {

			if (navigator.getVRDisplays !== undefined) {

				navigator.getVRDisplays().then(function (displays) {

					if (displays.length === 0) {

						reject('WebVR supported, but no VRDisplays found.');
					} else {

						resolve();
					}
				});
			} else {

				reject('Your browser does not support WebVR. See <a href="https://webvr.info">webvr.info</a> for assistance.');
			}
		});
	},

	getVRDisplay: function getVRDisplay(onDisplay) {

		if ('getVRDisplays' in navigator) {

			navigator.getVRDisplays().then(function (displays) {
				onDisplay(displays[0]);
			});
		}
	},

	getMessage: function getMessage() {

		console.warn('WEBVR: getMessage() is being deprecated. Use .getMessageContainer( message ) instead.');

		var message;

		if (navigator.getVRDisplays) {

			navigator.getVRDisplays().then(function (displays) {

				if (displays.length === 0) message = 'WebVR supported, but no VRDisplays found.';
			});
		} else {

			message = 'Your browser does not support WebVR. See <a href="http://webvr.info">webvr.info</a> for assistance.';
		}

		if (message !== undefined) {

			var container = document.createElement('div');
			container.style.position = 'absolute';
			container.style.left = '0';
			container.style.top = '0';
			container.style.right = '0';
			container.style.zIndex = '999';
			container.align = 'center';

			var error = document.createElement('div');
			error.style.fontFamily = 'sans-serif';
			error.style.fontSize = '16px';
			error.style.fontStyle = 'normal';
			error.style.lineHeight = '26px';
			error.style.backgroundColor = '#fff';
			error.style.color = '#000';
			error.style.padding = '10px 20px';
			error.style.margin = '50px';
			error.style.display = 'inline-block';
			error.innerHTML = message;
			container.appendChild(error);

			return container;
		}
	},

	getMessageContainer: function getMessageContainer(message) {

		var container = document.createElement('div');
		container.style.position = 'absolute';
		container.style.left = '0';
		container.style.top = '0';
		container.style.right = '0';
		container.style.zIndex = '999';
		container.align = 'center';

		var error = document.createElement('div');
		error.style.fontFamily = 'sans-serif';
		error.style.fontSize = '16px';
		error.style.fontStyle = 'normal';
		error.style.lineHeight = '26px';
		error.style.backgroundColor = '#fff';
		error.style.color = '#000';
		error.style.padding = '10px 20px';
		error.style.margin = '50px';
		error.style.display = 'inline-block';
		error.innerHTML = message;
		container.appendChild(error);

		return container;
	},

	getButton: function getButton(display, canvas) {

		if ('VREffect' in THREE && display instanceof THREE.VREffect) {

			console.error('WebVR.getButton() now expects a VRDisplay.');
			return document.createElement('button');
		}

		var button = document.createElement('button');
		button.style.position = 'absolute';
		button.style.left = 'calc(50% - 50px)';
		button.style.bottom = '20px';
		button.style.width = '100px';
		button.style.border = '0';
		button.style.padding = '8px';
		button.style.cursor = 'pointer';
		button.style.backgroundColor = '#000';
		button.style.color = '#fff';
		button.style.fontFamily = 'sans-serif';
		button.style.fontSize = '13px';
		button.style.fontStyle = 'normal';
		button.style.textAlign = 'center';
		button.style.zIndex = '999';

		if (display) {

			button.textContent = 'ENTER VR';
			button.onclick = function () {

				display.isPresenting ? display.exitPresent() : display.requestPresent([{ source: canvas }]);
			};

			window.addEventListener('vrdisplaypresentchange', function () {

				button.textContent = display.isPresenting ? 'EXIT VR' : 'ENTER VR';
			}, false);
		} else {

			button.textContent = 'NO VR DISPLAY';
		}

		return button;
	}

};

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();









var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};

var VRModule = function () {
  function VRModule() {
    var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    classCallCheck(this, VRModule);

    this.params = Object.assign(params, {
      message: true,
      button: true
    });

    this.scene = null;
    this.camera = null;
    this.effect = null;
  }

  createClass(VRModule, [{
    key: 'manager',
    value: function manager(_manager) {
      var _this = this;

      _manager.define('vr');

      if (three.REVISION > 86) console.warn('Please use VRModule2 for Three.js ^0.87.0 (r87)');

      var rendering = _manager.use('rendering');
      var renderer = _manager.get('renderer');

      var resize = _manager.use('resize');

      this.effect = new VREffect(renderer);

      this.scene = _manager.get('scene');
      this.camera = _manager.get('camera');

      rendering.effect(this.effect);

      // TODO: Fix resize.

      resize.addCallback(function (width, height) {
        _this.effect.setSize(+width, +height);
      });

      // WEBVR
      var _params = this.params,
          message = _params.message,
          button = _params.button;


      if (message) WEBVR.checkAvailability().catch(function (message) {
        document.body.appendChild(WEBVR.getMessageContainer(message));
      });

      if (button) WEBVR.getVRDisplay(function (display) {
        var vrbtn = WEBVR.getButton(display, renderer.domElement);
        vrbtn.className = 'vr-btn';

        document.body.appendChild(vrbtn);
      });
    }
  }]);
  return VRModule;
}();

var VR2Module = function () {
  function VR2Module() {
    classCallCheck(this, VR2Module);

    this.display = new Promise(function (resolve) {
      return WEBVR.getVRDisplay(function (display) {
        return resolve(display);
      });
    });
  }

  createClass(VR2Module, [{
    key: 'manager',
    value: function manager(_manager2) {
      _manager2.define('vr');

      var renderer = _manager2.get('renderer');
      renderer.vr.enabled = true;
      console.log(three.REVISION);
      console.log(1);

      this.display.then(function (display) {
        renderer.vr.setDevice(display);

        var vrbtn = WEBVR.getButton(display, renderer.domElement);
        vrbtn.className = 'vr-btn';

        document.body.appendChild(vrbtn);
      });
    }
  }]);
  return VR2Module;
}();

var VRControls = function (_ControlsModule) {
  inherits(VRControls, _ControlsModule);

  function VRControls(_ref) {
    var object = _ref.object,
        onError = _ref.onError,
        intensity = _ref.intensity;
    classCallCheck(this, VRControls);

    var controls = new VRControls$1(object.native, onError);

    controls.standing = true;
    controls.scale = intensity;

    return possibleConstructorReturn(this, (VRControls.__proto__ || Object.getPrototypeOf(VRControls)).call(this, { controls: controls }));
  }

  return VRControls;
}(whs.ControlsModule);

exports.WEBVR = WEBVR;
exports.VRModule = VRModule;
exports.VR2Module = VR2Module;
exports.VRControls = VRControls;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVlJLaXQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9tb2R1bGVzL2V4dHJhL3ZyL1ZSRWZmZWN0LmpzIiwiLi4vc3JjL21vZHVsZXMvZXh0cmEvbm9kZV9tb2R1bGVzL3RocmVlLXZyY29udHJvbHMtbW9kdWxlL3NyYy92ci1jb250cm9scy5qcyIsIi4uL3NyYy9tb2R1bGVzL2V4dHJhL3ZyL1dlYlZSLmpzIiwiLi4vc3JjL21vZHVsZXMvZXh0cmEvVlJLaXQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAYXV0aG9yIGRtYXJjb3MgLyBodHRwczovL2dpdGh1Yi5jb20vZG1hcmNvc1xuICogQGF1dGhvciBtcmRvb2IgLyBodHRwOi8vbXJkb29iLmNvbVxuICpcbiAqIFdlYlZSIFNwZWM6IGh0dHA6Ly9tb3p2ci5naXRodWIuaW8vd2VidnItc3BlYy93ZWJ2ci5odG1sXG4gKlxuICogRmlyZWZveDogaHR0cDovL21venZyLmNvbS9kb3dubG9hZHMvXG4gKiBDaHJvbWl1bTogaHR0cHM6Ly93ZWJ2ci5pbmZvL2dldC1jaHJvbWVcbiAqXG4gKi9cblxuZXhwb3J0IGNvbnN0IFZSRWZmZWN0ID0gZnVuY3Rpb24gKCByZW5kZXJlciwgb25FcnJvciApIHtcblxuXHR2YXIgdnJEaXNwbGF5LCB2ckRpc3BsYXlzO1xuXHR2YXIgZXllVHJhbnNsYXRpb25MID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblx0dmFyIGV5ZVRyYW5zbGF0aW9uUiA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cdHZhciByZW5kZXJSZWN0TCwgcmVuZGVyUmVjdFI7XG5cblx0dmFyIGZyYW1lRGF0YSA9IG51bGw7XG5cblx0aWYgKCAnVlJGcmFtZURhdGEnIGluIHdpbmRvdyApIHtcblxuXHRcdGZyYW1lRGF0YSA9IG5ldyBWUkZyYW1lRGF0YSgpO1xuXG5cdH1cblxuXHRmdW5jdGlvbiBnb3RWUkRpc3BsYXlzKCBkaXNwbGF5cyApIHtcblxuXHRcdHZyRGlzcGxheXMgPSBkaXNwbGF5cztcblxuXHRcdGlmICggZGlzcGxheXMubGVuZ3RoID4gMCApIHtcblxuXHRcdFx0dnJEaXNwbGF5ID0gZGlzcGxheXNbIDAgXTtcblxuXHRcdH0gZWxzZSB7XG5cblx0XHRcdGlmICggb25FcnJvciApIG9uRXJyb3IoICdITUQgbm90IGF2YWlsYWJsZScgKTtcblxuXHRcdH1cblxuXHR9XG5cblx0aWYgKCBuYXZpZ2F0b3IuZ2V0VlJEaXNwbGF5cyApIHtcblxuXHRcdG5hdmlnYXRvci5nZXRWUkRpc3BsYXlzKCkudGhlbiggZ290VlJEaXNwbGF5cyApLmNhdGNoICggZnVuY3Rpb24gKCkge1xuXG5cdFx0XHRjb25zb2xlLndhcm4oICdUSFJFRS5WUkVmZmVjdDogVW5hYmxlIHRvIGdldCBWUiBEaXNwbGF5cycgKTtcblxuXHRcdH0gKTtcblxuXHR9XG5cblx0Ly9cblxuXHR0aGlzLmlzUHJlc2VudGluZyA9IGZhbHNlO1xuXHR0aGlzLnNjYWxlID0gMTtcblxuXHR2YXIgc2NvcGUgPSB0aGlzO1xuXG5cdHZhciByZW5kZXJlclNpemUgPSByZW5kZXJlci5nZXRTaXplKCk7XG5cdHZhciByZW5kZXJlclVwZGF0ZVN0eWxlID0gZmFsc2U7XG5cdHZhciByZW5kZXJlclBpeGVsUmF0aW8gPSByZW5kZXJlci5nZXRQaXhlbFJhdGlvKCk7XG5cblx0dGhpcy5nZXRWUkRpc3BsYXkgPSBmdW5jdGlvbiAoKSB7XG5cblx0XHRyZXR1cm4gdnJEaXNwbGF5O1xuXG5cdH07XG5cblx0dGhpcy5zZXRWUkRpc3BsYXkgPSBmdW5jdGlvbiAoIHZhbHVlICkge1xuXG5cdFx0dnJEaXNwbGF5ID0gdmFsdWU7XG5cblx0fTtcblxuXHR0aGlzLmdldFZSRGlzcGxheXMgPSBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zb2xlLndhcm4oICdUSFJFRS5WUkVmZmVjdDogZ2V0VlJEaXNwbGF5cygpIGlzIGJlaW5nIGRlcHJlY2F0ZWQuJyApO1xuXHRcdHJldHVybiB2ckRpc3BsYXlzO1xuXG5cdH07XG5cblx0dGhpcy5zZXRTaXplID0gZnVuY3Rpb24gKCB3aWR0aCwgaGVpZ2h0LCB1cGRhdGVTdHlsZSApIHtcblxuXHRcdHJlbmRlcmVyU2l6ZSA9IHsgd2lkdGg6IHdpZHRoLCBoZWlnaHQ6IGhlaWdodCB9O1xuXHRcdHJlbmRlcmVyVXBkYXRlU3R5bGUgPSB1cGRhdGVTdHlsZTtcblxuXHRcdGlmICggc2NvcGUuaXNQcmVzZW50aW5nICkge1xuXG5cdFx0XHR2YXIgZXllUGFyYW1zTCA9IHZyRGlzcGxheS5nZXRFeWVQYXJhbWV0ZXJzKCAnbGVmdCcgKTtcblx0XHRcdHJlbmRlcmVyLnNldFBpeGVsUmF0aW8oIDEgKTtcblx0XHRcdHJlbmRlcmVyLnNldFNpemUoIGV5ZVBhcmFtc0wucmVuZGVyV2lkdGggKiAyLCBleWVQYXJhbXNMLnJlbmRlckhlaWdodCwgZmFsc2UgKTtcblxuXHRcdH0gZWxzZSB7XG5cblx0XHRcdHJlbmRlcmVyLnNldFBpeGVsUmF0aW8oIHJlbmRlcmVyUGl4ZWxSYXRpbyApO1xuXHRcdFx0cmVuZGVyZXIuc2V0U2l6ZSggd2lkdGgsIGhlaWdodCwgdXBkYXRlU3R5bGUgKTtcblxuXHRcdH1cblxuXHR9O1xuXG5cdC8vIGZ1bGxzY3JlZW5cblxuXHR2YXIgY2FudmFzID0gcmVuZGVyZXIuZG9tRWxlbWVudDtcblx0dmFyIHJlcXVlc3RGdWxsc2NyZWVuO1xuXHR2YXIgZXhpdEZ1bGxzY3JlZW47XG5cdHZhciBmdWxsc2NyZWVuRWxlbWVudDtcblx0dmFyIGRlZmF1bHRMZWZ0Qm91bmRzID0gWyAwLjAsIDAuMCwgMC41LCAxLjAgXTtcblx0dmFyIGRlZmF1bHRSaWdodEJvdW5kcyA9IFsgMC41LCAwLjAsIDAuNSwgMS4wIF07XG5cblx0ZnVuY3Rpb24gb25WUkRpc3BsYXlQcmVzZW50Q2hhbmdlKCkge1xuXG5cdFx0dmFyIHdhc1ByZXNlbnRpbmcgPSBzY29wZS5pc1ByZXNlbnRpbmc7XG5cdFx0c2NvcGUuaXNQcmVzZW50aW5nID0gdnJEaXNwbGF5ICE9PSB1bmRlZmluZWQgJiYgdnJEaXNwbGF5LmlzUHJlc2VudGluZztcblxuXHRcdGlmICggc2NvcGUuaXNQcmVzZW50aW5nICkge1xuXG5cdFx0XHR2YXIgZXllUGFyYW1zTCA9IHZyRGlzcGxheS5nZXRFeWVQYXJhbWV0ZXJzKCAnbGVmdCcgKTtcblx0XHRcdHZhciBleWVXaWR0aCA9IGV5ZVBhcmFtc0wucmVuZGVyV2lkdGg7XG5cdFx0XHR2YXIgZXllSGVpZ2h0ID0gZXllUGFyYW1zTC5yZW5kZXJIZWlnaHQ7XG5cblx0XHRcdGlmICggIXdhc1ByZXNlbnRpbmcgKSB7XG5cblx0XHRcdFx0cmVuZGVyZXJQaXhlbFJhdGlvID0gcmVuZGVyZXIuZ2V0UGl4ZWxSYXRpbygpO1xuXHRcdFx0XHRyZW5kZXJlclNpemUgPSByZW5kZXJlci5nZXRTaXplKCk7XG5cblx0XHRcdFx0cmVuZGVyZXIuc2V0UGl4ZWxSYXRpbyggMSApO1xuXHRcdFx0XHRyZW5kZXJlci5zZXRTaXplKCBleWVXaWR0aCAqIDIsIGV5ZUhlaWdodCwgZmFsc2UgKTtcblxuXHRcdFx0fVxuXG5cdFx0fSBlbHNlIGlmICggd2FzUHJlc2VudGluZyApIHtcblxuXHRcdFx0cmVuZGVyZXIuc2V0UGl4ZWxSYXRpbyggcmVuZGVyZXJQaXhlbFJhdGlvICk7XG5cdFx0XHRyZW5kZXJlci5zZXRTaXplKCByZW5kZXJlclNpemUud2lkdGgsIHJlbmRlcmVyU2l6ZS5oZWlnaHQsIHJlbmRlcmVyVXBkYXRlU3R5bGUgKTtcblxuXHRcdH1cblxuXHR9XG5cblx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICd2cmRpc3BsYXlwcmVzZW50Y2hhbmdlJywgb25WUkRpc3BsYXlQcmVzZW50Q2hhbmdlLCBmYWxzZSApO1xuXG5cdHRoaXMuc2V0RnVsbFNjcmVlbiA9IGZ1bmN0aW9uICggYm9vbGVhbiApIHtcblxuXHRcdHJldHVybiBuZXcgUHJvbWlzZSggZnVuY3Rpb24gKCByZXNvbHZlLCByZWplY3QgKSB7XG5cblx0XHRcdGlmICggdnJEaXNwbGF5ID09PSB1bmRlZmluZWQgKSB7XG5cblx0XHRcdFx0cmVqZWN0KCBuZXcgRXJyb3IoICdObyBWUiBoYXJkd2FyZSBmb3VuZC4nICkgKTtcblx0XHRcdFx0cmV0dXJuO1xuXG5cdFx0XHR9XG5cblx0XHRcdGlmICggc2NvcGUuaXNQcmVzZW50aW5nID09PSBib29sZWFuICkge1xuXG5cdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0cmV0dXJuO1xuXG5cdFx0XHR9XG5cblx0XHRcdGlmICggYm9vbGVhbiApIHtcblxuXHRcdFx0XHRyZXNvbHZlKCB2ckRpc3BsYXkucmVxdWVzdFByZXNlbnQoIFsgeyBzb3VyY2U6IGNhbnZhcyB9IF0gKSApO1xuXG5cdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdHJlc29sdmUoIHZyRGlzcGxheS5leGl0UHJlc2VudCgpICk7XG5cblx0XHRcdH1cblxuXHRcdH0gKTtcblxuXHR9O1xuXG5cdHRoaXMucmVxdWVzdFByZXNlbnQgPSBmdW5jdGlvbiAoKSB7XG5cblx0XHRyZXR1cm4gdGhpcy5zZXRGdWxsU2NyZWVuKCB0cnVlICk7XG5cblx0fTtcblxuXHR0aGlzLmV4aXRQcmVzZW50ID0gZnVuY3Rpb24gKCkge1xuXG5cdFx0cmV0dXJuIHRoaXMuc2V0RnVsbFNjcmVlbiggZmFsc2UgKTtcblxuXHR9O1xuXG5cdHRoaXMucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24gKCBmICkge1xuXG5cdFx0aWYgKCB2ckRpc3BsYXkgIT09IHVuZGVmaW5lZCApIHtcblxuXHRcdFx0cmV0dXJuIHZyRGlzcGxheS5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIGYgKTtcblxuXHRcdH0gZWxzZSB7XG5cblx0XHRcdHJldHVybiB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmICk7XG5cblx0XHR9XG5cblx0fTtcblxuXHR0aGlzLmNhbmNlbEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24gKCBoICkge1xuXG5cdFx0aWYgKCB2ckRpc3BsYXkgIT09IHVuZGVmaW5lZCApIHtcblxuXHRcdFx0dnJEaXNwbGF5LmNhbmNlbEFuaW1hdGlvbkZyYW1lKCBoICk7XG5cblx0XHR9IGVsc2Uge1xuXG5cdFx0XHR3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUoIGggKTtcblxuXHRcdH1cblxuXHR9O1xuXG5cdHRoaXMuc3VibWl0RnJhbWUgPSBmdW5jdGlvbiAoKSB7XG5cblx0XHRpZiAoIHZyRGlzcGxheSAhPT0gdW5kZWZpbmVkICYmIHNjb3BlLmlzUHJlc2VudGluZyApIHtcblxuXHRcdFx0dnJEaXNwbGF5LnN1Ym1pdEZyYW1lKCk7XG5cblx0XHR9XG5cblx0fTtcblxuXHR0aGlzLmF1dG9TdWJtaXRGcmFtZSA9IHRydWU7XG5cblx0Ly8gcmVuZGVyXG5cblx0dmFyIGNhbWVyYUwgPSBuZXcgVEhSRUUuUGVyc3BlY3RpdmVDYW1lcmEoKTtcblx0Y2FtZXJhTC5sYXllcnMuZW5hYmxlKCAxICk7XG5cblx0dmFyIGNhbWVyYVIgPSBuZXcgVEhSRUUuUGVyc3BlY3RpdmVDYW1lcmEoKTtcblx0Y2FtZXJhUi5sYXllcnMuZW5hYmxlKCAyICk7XG5cblx0dGhpcy5yZW5kZXIgPSBmdW5jdGlvbiAoIHNjZW5lLCBjYW1lcmEsIHJlbmRlclRhcmdldCwgZm9yY2VDbGVhciApIHtcblxuXHRcdGlmICggdnJEaXNwbGF5ICYmIHNjb3BlLmlzUHJlc2VudGluZyApIHtcblxuXHRcdFx0dmFyIGF1dG9VcGRhdGUgPSBzY2VuZS5hdXRvVXBkYXRlO1xuXG5cdFx0XHRpZiAoIGF1dG9VcGRhdGUgKSB7XG5cblx0XHRcdFx0c2NlbmUudXBkYXRlTWF0cml4V29ybGQoKTtcblx0XHRcdFx0c2NlbmUuYXV0b1VwZGF0ZSA9IGZhbHNlO1xuXG5cdFx0XHR9XG5cblx0XHRcdHZhciBleWVQYXJhbXNMID0gdnJEaXNwbGF5LmdldEV5ZVBhcmFtZXRlcnMoICdsZWZ0JyApO1xuXHRcdFx0dmFyIGV5ZVBhcmFtc1IgPSB2ckRpc3BsYXkuZ2V0RXllUGFyYW1ldGVycyggJ3JpZ2h0JyApO1xuXG5cdFx0XHRleWVUcmFuc2xhdGlvbkwuZnJvbUFycmF5KCBleWVQYXJhbXNMLm9mZnNldCApO1xuXHRcdFx0ZXllVHJhbnNsYXRpb25SLmZyb21BcnJheSggZXllUGFyYW1zUi5vZmZzZXQgKTtcblxuXHRcdFx0aWYgKCBBcnJheS5pc0FycmF5KCBzY2VuZSApICkge1xuXG5cdFx0XHRcdGNvbnNvbGUud2FybiggJ1RIUkVFLlZSRWZmZWN0LnJlbmRlcigpIG5vIGxvbmdlciBzdXBwb3J0cyBhcnJheXMuIFVzZSBvYmplY3QubGF5ZXJzIGluc3RlYWQuJyApO1xuXHRcdFx0XHRzY2VuZSA9IHNjZW5lWyAwIF07XG5cblx0XHRcdH1cblxuXHRcdFx0Ly8gV2hlbiByZW5kZXJpbmcgd2UgZG9uJ3QgY2FyZSB3aGF0IHRoZSByZWNvbW1lbmRlZCBzaXplIGlzLCBvbmx5IHdoYXQgdGhlIGFjdHVhbCBzaXplXG5cdFx0XHQvLyBvZiB0aGUgYmFja2J1ZmZlciBpcy5cblx0XHRcdHZhciBzaXplID0gcmVuZGVyZXIuZ2V0U2l6ZSgpO1xuXHRcdFx0dmFyIGxheWVycyA9IHZyRGlzcGxheS5nZXRMYXllcnMoKTtcblx0XHRcdHZhciBsZWZ0Qm91bmRzO1xuXHRcdFx0dmFyIHJpZ2h0Qm91bmRzO1xuXG5cdFx0XHRpZiAoIGxheWVycy5sZW5ndGggKSB7XG5cblx0XHRcdFx0dmFyIGxheWVyID0gbGF5ZXJzWyAwIF07XG5cblx0XHRcdFx0bGVmdEJvdW5kcyA9IGxheWVyLmxlZnRCb3VuZHMgIT09IG51bGwgJiYgbGF5ZXIubGVmdEJvdW5kcy5sZW5ndGggPT09IDQgPyBsYXllci5sZWZ0Qm91bmRzIDogZGVmYXVsdExlZnRCb3VuZHM7XG5cdFx0XHRcdHJpZ2h0Qm91bmRzID0gbGF5ZXIucmlnaHRCb3VuZHMgIT09IG51bGwgJiYgbGF5ZXIucmlnaHRCb3VuZHMubGVuZ3RoID09PSA0ID8gbGF5ZXIucmlnaHRCb3VuZHMgOiBkZWZhdWx0UmlnaHRCb3VuZHM7XG5cblx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0bGVmdEJvdW5kcyA9IGRlZmF1bHRMZWZ0Qm91bmRzO1xuXHRcdFx0XHRyaWdodEJvdW5kcyA9IGRlZmF1bHRSaWdodEJvdW5kcztcblxuXHRcdFx0fVxuXG5cdFx0XHRyZW5kZXJSZWN0TCA9IHtcblx0XHRcdFx0eDogTWF0aC5yb3VuZCggc2l6ZS53aWR0aCAqIGxlZnRCb3VuZHNbIDAgXSApLFxuXHRcdFx0XHR5OiBNYXRoLnJvdW5kKCBzaXplLmhlaWdodCAqIGxlZnRCb3VuZHNbIDEgXSApLFxuXHRcdFx0XHR3aWR0aDogTWF0aC5yb3VuZCggc2l6ZS53aWR0aCAqIGxlZnRCb3VuZHNbIDIgXSApLFxuXHRcdFx0XHRoZWlnaHQ6IE1hdGgucm91bmQoc2l6ZS5oZWlnaHQgKiBsZWZ0Qm91bmRzWyAzIF0gKVxuXHRcdFx0fTtcblx0XHRcdHJlbmRlclJlY3RSID0ge1xuXHRcdFx0XHR4OiBNYXRoLnJvdW5kKCBzaXplLndpZHRoICogcmlnaHRCb3VuZHNbIDAgXSApLFxuXHRcdFx0XHR5OiBNYXRoLnJvdW5kKCBzaXplLmhlaWdodCAqIHJpZ2h0Qm91bmRzWyAxIF0gKSxcblx0XHRcdFx0d2lkdGg6IE1hdGgucm91bmQoIHNpemUud2lkdGggKiByaWdodEJvdW5kc1sgMiBdICksXG5cdFx0XHRcdGhlaWdodDogTWF0aC5yb3VuZChzaXplLmhlaWdodCAqIHJpZ2h0Qm91bmRzWyAzIF0gKVxuXHRcdFx0fTtcblxuXHRcdFx0aWYgKCByZW5kZXJUYXJnZXQgKSB7XG5cblx0XHRcdFx0cmVuZGVyZXIuc2V0UmVuZGVyVGFyZ2V0KCByZW5kZXJUYXJnZXQgKTtcblx0XHRcdFx0cmVuZGVyVGFyZ2V0LnNjaXNzb3JUZXN0ID0gdHJ1ZTtcblxuXHRcdFx0fSBlbHNlIHtcblxuXHRcdFx0XHRyZW5kZXJlci5zZXRSZW5kZXJUYXJnZXQoIG51bGwgKTtcblx0XHRcdFx0cmVuZGVyZXIuc2V0U2Npc3NvclRlc3QoIHRydWUgKTtcblxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIHJlbmRlcmVyLmF1dG9DbGVhciB8fCBmb3JjZUNsZWFyICkgcmVuZGVyZXIuY2xlYXIoKTtcblxuXHRcdFx0aWYgKCBjYW1lcmEucGFyZW50ID09PSBudWxsICkgY2FtZXJhLnVwZGF0ZU1hdHJpeFdvcmxkKCk7XG5cblx0XHRcdGNhbWVyYS5tYXRyaXhXb3JsZC5kZWNvbXBvc2UoIGNhbWVyYUwucG9zaXRpb24sIGNhbWVyYUwucXVhdGVybmlvbiwgY2FtZXJhTC5zY2FsZSApO1xuXHRcdFx0Y2FtZXJhLm1hdHJpeFdvcmxkLmRlY29tcG9zZSggY2FtZXJhUi5wb3NpdGlvbiwgY2FtZXJhUi5xdWF0ZXJuaW9uLCBjYW1lcmFSLnNjYWxlICk7XG5cblx0XHRcdHZhciBzY2FsZSA9IHRoaXMuc2NhbGU7XG5cdFx0XHRjYW1lcmFMLnRyYW5zbGF0ZU9uQXhpcyggZXllVHJhbnNsYXRpb25MLCBzY2FsZSApO1xuXHRcdFx0Y2FtZXJhUi50cmFuc2xhdGVPbkF4aXMoIGV5ZVRyYW5zbGF0aW9uUiwgc2NhbGUgKTtcblxuXHRcdFx0aWYgKCB2ckRpc3BsYXkuZ2V0RnJhbWVEYXRhICkge1xuXG5cdFx0XHRcdHZyRGlzcGxheS5kZXB0aE5lYXIgPSBjYW1lcmEubmVhcjtcblx0XHRcdFx0dnJEaXNwbGF5LmRlcHRoRmFyID0gY2FtZXJhLmZhcjtcblxuXHRcdFx0XHR2ckRpc3BsYXkuZ2V0RnJhbWVEYXRhKCBmcmFtZURhdGEgKTtcblxuXHRcdFx0XHRjYW1lcmFMLnByb2plY3Rpb25NYXRyaXguZWxlbWVudHMgPSBmcmFtZURhdGEubGVmdFByb2plY3Rpb25NYXRyaXg7XG5cdFx0XHRcdGNhbWVyYVIucHJvamVjdGlvbk1hdHJpeC5lbGVtZW50cyA9IGZyYW1lRGF0YS5yaWdodFByb2plY3Rpb25NYXRyaXg7XG5cblx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0Y2FtZXJhTC5wcm9qZWN0aW9uTWF0cml4ID0gZm92VG9Qcm9qZWN0aW9uKCBleWVQYXJhbXNMLmZpZWxkT2ZWaWV3LCB0cnVlLCBjYW1lcmEubmVhciwgY2FtZXJhLmZhciApO1xuXHRcdFx0XHRjYW1lcmFSLnByb2plY3Rpb25NYXRyaXggPSBmb3ZUb1Byb2plY3Rpb24oIGV5ZVBhcmFtc1IuZmllbGRPZlZpZXcsIHRydWUsIGNhbWVyYS5uZWFyLCBjYW1lcmEuZmFyICk7XG5cblx0XHRcdH1cblxuXHRcdFx0Ly8gcmVuZGVyIGxlZnQgZXllXG5cdFx0XHRpZiAoIHJlbmRlclRhcmdldCApIHtcblxuXHRcdFx0XHRyZW5kZXJUYXJnZXQudmlld3BvcnQuc2V0KCByZW5kZXJSZWN0TC54LCByZW5kZXJSZWN0TC55LCByZW5kZXJSZWN0TC53aWR0aCwgcmVuZGVyUmVjdEwuaGVpZ2h0ICk7XG5cdFx0XHRcdHJlbmRlclRhcmdldC5zY2lzc29yLnNldCggcmVuZGVyUmVjdEwueCwgcmVuZGVyUmVjdEwueSwgcmVuZGVyUmVjdEwud2lkdGgsIHJlbmRlclJlY3RMLmhlaWdodCApO1xuXG5cdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdHJlbmRlcmVyLnNldFZpZXdwb3J0KCByZW5kZXJSZWN0TC54LCByZW5kZXJSZWN0TC55LCByZW5kZXJSZWN0TC53aWR0aCwgcmVuZGVyUmVjdEwuaGVpZ2h0ICk7XG5cdFx0XHRcdHJlbmRlcmVyLnNldFNjaXNzb3IoIHJlbmRlclJlY3RMLngsIHJlbmRlclJlY3RMLnksIHJlbmRlclJlY3RMLndpZHRoLCByZW5kZXJSZWN0TC5oZWlnaHQgKTtcblxuXHRcdFx0fVxuXHRcdFx0cmVuZGVyZXIucmVuZGVyKCBzY2VuZSwgY2FtZXJhTCwgcmVuZGVyVGFyZ2V0LCBmb3JjZUNsZWFyICk7XG5cblx0XHRcdC8vIHJlbmRlciByaWdodCBleWVcblx0XHRcdGlmICggcmVuZGVyVGFyZ2V0ICkge1xuXG5cdFx0XHRcdHJlbmRlclRhcmdldC52aWV3cG9ydC5zZXQoIHJlbmRlclJlY3RSLngsIHJlbmRlclJlY3RSLnksIHJlbmRlclJlY3RSLndpZHRoLCByZW5kZXJSZWN0Ui5oZWlnaHQgKTtcblx0XHRcdFx0cmVuZGVyVGFyZ2V0LnNjaXNzb3Iuc2V0KCByZW5kZXJSZWN0Ui54LCByZW5kZXJSZWN0Ui55LCByZW5kZXJSZWN0Ui53aWR0aCwgcmVuZGVyUmVjdFIuaGVpZ2h0ICk7XG5cblx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0cmVuZGVyZXIuc2V0Vmlld3BvcnQoIHJlbmRlclJlY3RSLngsIHJlbmRlclJlY3RSLnksIHJlbmRlclJlY3RSLndpZHRoLCByZW5kZXJSZWN0Ui5oZWlnaHQgKTtcblx0XHRcdFx0cmVuZGVyZXIuc2V0U2Npc3NvciggcmVuZGVyUmVjdFIueCwgcmVuZGVyUmVjdFIueSwgcmVuZGVyUmVjdFIud2lkdGgsIHJlbmRlclJlY3RSLmhlaWdodCApO1xuXG5cdFx0XHR9XG5cdFx0XHRyZW5kZXJlci5yZW5kZXIoIHNjZW5lLCBjYW1lcmFSLCByZW5kZXJUYXJnZXQsIGZvcmNlQ2xlYXIgKTtcblxuXHRcdFx0aWYgKCByZW5kZXJUYXJnZXQgKSB7XG5cblx0XHRcdFx0cmVuZGVyVGFyZ2V0LnZpZXdwb3J0LnNldCggMCwgMCwgc2l6ZS53aWR0aCwgc2l6ZS5oZWlnaHQgKTtcblx0XHRcdFx0cmVuZGVyVGFyZ2V0LnNjaXNzb3Iuc2V0KCAwLCAwLCBzaXplLndpZHRoLCBzaXplLmhlaWdodCApO1xuXHRcdFx0XHRyZW5kZXJUYXJnZXQuc2Npc3NvclRlc3QgPSBmYWxzZTtcblx0XHRcdFx0cmVuZGVyZXIuc2V0UmVuZGVyVGFyZ2V0KCBudWxsICk7XG5cblx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0cmVuZGVyZXIuc2V0Vmlld3BvcnQoIDAsIDAsIHNpemUud2lkdGgsIHNpemUuaGVpZ2h0ICk7XG5cdFx0XHRcdHJlbmRlcmVyLnNldFNjaXNzb3JUZXN0KCBmYWxzZSApO1xuXG5cdFx0XHR9XG5cblx0XHRcdGlmICggYXV0b1VwZGF0ZSApIHtcblxuXHRcdFx0XHRzY2VuZS5hdXRvVXBkYXRlID0gdHJ1ZTtcblxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIHNjb3BlLmF1dG9TdWJtaXRGcmFtZSApIHtcblxuXHRcdFx0XHRzY29wZS5zdWJtaXRGcmFtZSgpO1xuXG5cdFx0XHR9XG5cblx0XHRcdHJldHVybjtcblxuXHRcdH1cblxuXHRcdC8vIFJlZ3VsYXIgcmVuZGVyIG1vZGUgaWYgbm90IEhNRFxuXG5cdFx0cmVuZGVyZXIucmVuZGVyKCBzY2VuZSwgY2FtZXJhLCByZW5kZXJUYXJnZXQsIGZvcmNlQ2xlYXIgKTtcblxuXHR9O1xuXG5cdHRoaXMuZGlzcG9zZSA9IGZ1bmN0aW9uICgpIHtcblxuXHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCAndnJkaXNwbGF5cHJlc2VudGNoYW5nZScsIG9uVlJEaXNwbGF5UHJlc2VudENoYW5nZSwgZmFsc2UgKTtcblxuXHR9O1xuXG5cdC8vXG5cblx0ZnVuY3Rpb24gZm92VG9ORENTY2FsZU9mZnNldCggZm92ICkge1xuXG5cdFx0dmFyIHB4c2NhbGUgPSAyLjAgLyAoIGZvdi5sZWZ0VGFuICsgZm92LnJpZ2h0VGFuICk7XG5cdFx0dmFyIHB4b2Zmc2V0ID0gKCBmb3YubGVmdFRhbiAtIGZvdi5yaWdodFRhbiApICogcHhzY2FsZSAqIDAuNTtcblx0XHR2YXIgcHlzY2FsZSA9IDIuMCAvICggZm92LnVwVGFuICsgZm92LmRvd25UYW4gKTtcblx0XHR2YXIgcHlvZmZzZXQgPSAoIGZvdi51cFRhbiAtIGZvdi5kb3duVGFuICkgKiBweXNjYWxlICogMC41O1xuXHRcdHJldHVybiB7IHNjYWxlOiBbIHB4c2NhbGUsIHB5c2NhbGUgXSwgb2Zmc2V0OiBbIHB4b2Zmc2V0LCBweW9mZnNldCBdIH07XG5cblx0fVxuXG5cdGZ1bmN0aW9uIGZvdlBvcnRUb1Byb2plY3Rpb24oIGZvdiwgcmlnaHRIYW5kZWQsIHpOZWFyLCB6RmFyICkge1xuXG5cdFx0cmlnaHRIYW5kZWQgPSByaWdodEhhbmRlZCA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IHJpZ2h0SGFuZGVkO1xuXHRcdHpOZWFyID0gek5lYXIgPT09IHVuZGVmaW5lZCA/IDAuMDEgOiB6TmVhcjtcblx0XHR6RmFyID0gekZhciA9PT0gdW5kZWZpbmVkID8gMTAwMDAuMCA6IHpGYXI7XG5cblx0XHR2YXIgaGFuZGVkbmVzc1NjYWxlID0gcmlnaHRIYW5kZWQgPyAtIDEuMCA6IDEuMDtcblxuXHRcdC8vIHN0YXJ0IHdpdGggYW4gaWRlbnRpdHkgbWF0cml4XG5cdFx0dmFyIG1vYmogPSBuZXcgVEhSRUUuTWF0cml4NCgpO1xuXHRcdHZhciBtID0gbW9iai5lbGVtZW50cztcblxuXHRcdC8vIGFuZCB3aXRoIHNjYWxlL29mZnNldCBpbmZvIGZvciBub3JtYWxpemVkIGRldmljZSBjb29yZHNcblx0XHR2YXIgc2NhbGVBbmRPZmZzZXQgPSBmb3ZUb05EQ1NjYWxlT2Zmc2V0KCBmb3YgKTtcblxuXHRcdC8vIFggcmVzdWx0LCBtYXAgY2xpcCBlZGdlcyB0byBbLXcsK3ddXG5cdFx0bVsgMCAqIDQgKyAwIF0gPSBzY2FsZUFuZE9mZnNldC5zY2FsZVsgMCBdO1xuXHRcdG1bIDAgKiA0ICsgMSBdID0gMC4wO1xuXHRcdG1bIDAgKiA0ICsgMiBdID0gc2NhbGVBbmRPZmZzZXQub2Zmc2V0WyAwIF0gKiBoYW5kZWRuZXNzU2NhbGU7XG5cdFx0bVsgMCAqIDQgKyAzIF0gPSAwLjA7XG5cblx0XHQvLyBZIHJlc3VsdCwgbWFwIGNsaXAgZWRnZXMgdG8gWy13LCt3XVxuXHRcdC8vIFkgb2Zmc2V0IGlzIG5lZ2F0ZWQgYmVjYXVzZSB0aGlzIHByb2ogbWF0cml4IHRyYW5zZm9ybXMgZnJvbSB3b3JsZCBjb29yZHMgd2l0aCBZPXVwLFxuXHRcdC8vIGJ1dCB0aGUgTkRDIHNjYWxpbmcgaGFzIFk9ZG93biAodGhhbmtzIEQzRD8pXG5cdFx0bVsgMSAqIDQgKyAwIF0gPSAwLjA7XG5cdFx0bVsgMSAqIDQgKyAxIF0gPSBzY2FsZUFuZE9mZnNldC5zY2FsZVsgMSBdO1xuXHRcdG1bIDEgKiA0ICsgMiBdID0gLSBzY2FsZUFuZE9mZnNldC5vZmZzZXRbIDEgXSAqIGhhbmRlZG5lc3NTY2FsZTtcblx0XHRtWyAxICogNCArIDMgXSA9IDAuMDtcblxuXHRcdC8vIFogcmVzdWx0ICh1cCB0byB0aGUgYXBwKVxuXHRcdG1bIDIgKiA0ICsgMCBdID0gMC4wO1xuXHRcdG1bIDIgKiA0ICsgMSBdID0gMC4wO1xuXHRcdG1bIDIgKiA0ICsgMiBdID0gekZhciAvICggek5lYXIgLSB6RmFyICkgKiAtIGhhbmRlZG5lc3NTY2FsZTtcblx0XHRtWyAyICogNCArIDMgXSA9ICggekZhciAqIHpOZWFyICkgLyAoIHpOZWFyIC0gekZhciApO1xuXG5cdFx0Ly8gVyByZXN1bHQgKD0gWiBpbilcblx0XHRtWyAzICogNCArIDAgXSA9IDAuMDtcblx0XHRtWyAzICogNCArIDEgXSA9IDAuMDtcblx0XHRtWyAzICogNCArIDIgXSA9IGhhbmRlZG5lc3NTY2FsZTtcblx0XHRtWyAzICogNCArIDMgXSA9IDAuMDtcblxuXHRcdG1vYmoudHJhbnNwb3NlKCk7XG5cblx0XHRyZXR1cm4gbW9iajtcblxuXHR9XG5cblx0ZnVuY3Rpb24gZm92VG9Qcm9qZWN0aW9uKCBmb3YsIHJpZ2h0SGFuZGVkLCB6TmVhciwgekZhciApIHtcblxuXHRcdHZhciBERUcyUkFEID0gTWF0aC5QSSAvIDE4MC4wO1xuXG5cdFx0dmFyIGZvdlBvcnQgPSB7XG5cdFx0XHR1cFRhbjogTWF0aC50YW4oIGZvdi51cERlZ3JlZXMgKiBERUcyUkFEICksXG5cdFx0XHRkb3duVGFuOiBNYXRoLnRhbiggZm92LmRvd25EZWdyZWVzICogREVHMlJBRCApLFxuXHRcdFx0bGVmdFRhbjogTWF0aC50YW4oIGZvdi5sZWZ0RGVncmVlcyAqIERFRzJSQUQgKSxcblx0XHRcdHJpZ2h0VGFuOiBNYXRoLnRhbiggZm92LnJpZ2h0RGVncmVlcyAqIERFRzJSQUQgKVxuXHRcdH07XG5cblx0XHRyZXR1cm4gZm92UG9ydFRvUHJvamVjdGlvbiggZm92UG9ydCwgcmlnaHRIYW5kZWQsIHpOZWFyLCB6RmFyICk7XG5cblx0fVxuXG59O1xuIiwiaW1wb3J0IHtNYXRyaXg0fSBmcm9tICd0aHJlZSc7XG5cbiAgICAvKipcbiAqIEBhdXRob3IgZG1hcmNvcyAvIGh0dHBzOi8vZ2l0aHViLmNvbS9kbWFyY29zXG4gKiBAYXV0aG9yIG1yZG9vYiAvIGh0dHA6Ly9tcmRvb2IuY29tXG4gKiBAYXV0aG9yIGhhbHZ2ZXMgLyBodHRwczovL2dpdGh1Yi5jb20vaGFsdnZlcyAoaSBvbmx5IGVzNiBtb2R1bGVkIGl0KVxuICovXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFZSQ29udHJvbHMge1xuICBjb25zdHJ1Y3RvcihjYW1lcmEsIG9uRXJyb3IpIHtcbiAgICB0aGlzLmNhbWVyYSA9IGNhbWVyYTtcbiAgICB0aGlzLnZyRGlzcGxheTtcbiAgICB0aGlzLnZyRGlzcGxheXM7XG4gICAgdGhpcy5zdGFuZGluZ01hdHJpeCA9IG5ldyBNYXRyaXg0KCk7XG4gICAgdGhpcy5mcmFtZURhdGEgPSBudWxsO1xuXG4gICAgaWYgKCdWUkZyYW1lRGF0YScgaW4gd2luZG93KSB7XG4gICAgICB0aGlzLmZyYW1lRGF0YSA9IG5ldyBWUkZyYW1lRGF0YSgpO1xuICAgIH1cblxuICAgIGlmIChuYXZpZ2F0b3IuZ2V0VlJEaXNwbGF5cykge1xuICAgICAgbmF2aWdhdG9yXG4gICAgICAgIC5nZXRWUkRpc3BsYXlzKClcbiAgICAgICAgLnRoZW4oKGRpc3BsYXlzKSA9PiB7XG4gICAgICAgICAgdGhpcy52ckRpc3BsYXlzID0gZGlzcGxheXM7XG4gICAgICAgICAgaWYgKGRpc3BsYXlzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMudnJEaXNwbGF5ID0gZGlzcGxheXNbMF07XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChvbkVycm9yKSBvbkVycm9yKCdWUiBpbnB1dCBub3QgYXZhaWxhYmxlLicpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKCgpID0+IHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oJ1ZSQ29udHJvbHM6IFVuYWJsZSB0byBnZXQgVlIgRGlzcGxheXMnKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gdGhlIFJpZnQgU0RLIHJldHVybnMgdGhlIHBvc2l0aW9uIGluIG1ldGVyc1xuICAgIC8vIHRoaXMgc2NhbGUgZmFjdG9yIGFsbG93cyB0aGUgdXNlciB0byBkZWZpbmUgaG93IG1ldGVyc1xuICAgIC8vIGFyZSBjb252ZXJ0ZWQgdG8gc2NlbmUgdW5pdHMuXG4gICAgdGhpcy5zY2FsZSA9IDE7XG5cbiAgICAvLyBJZiB0cnVlIHdpbGwgdXNlIFwic3RhbmRpbmcgc3BhY2VcIiBjb29yZGluYXRlIHN5c3RlbSB3aGVyZSB5PTAgaXMgdGhlXG4gICAgLy8gZmxvb3IgYW5kIHg9MCwgej0wIGlzIHRoZSBjZW50ZXIgb2YgdGhlIHJvb20uXG4gICAgdGhpcy5zdGFuZGluZyA9IGZhbHNlO1xuXG4gICAgLy8gRGlzdGFuY2UgZnJvbSB0aGUgdXNlcnMgZXllcyB0byB0aGUgZmxvb3IgaW4gbWV0ZXJzLiBVc2VkIHdoZW5cbiAgICAvLyBzdGFuZGluZz10cnVlIGJ1dCB0aGUgVlJEaXNwbGF5IGRvZXNuJ3QgcHJvdmlkZSBzdGFnZVBhcmFtZXRlcnMuXG4gICAgdGhpcy51c2VySGVpZ2h0ID0gMS42O1xuICB9XG5cbiAgZ2V0VlJEaXNwbGF5KCkge1xuICAgIHJldHVybiB0aGlzLnZyRGlzcGxheTtcbiAgfTtcblxuICBzZXRWUkRpc3BsYXkodmFsdWUpIHtcbiAgICB0aGlzLnZyRGlzcGxheSA9IHZhbHVlO1xuICB9O1xuXG4gIGdldFZSRGlzcGxheXMoKSB7XG4gICAgY29uc29sZS53YXJuKCdWUkNvbnRyb2xzOiBnZXRWUkRpc3BsYXlzKCkgaXMgYmVpbmcgZGVwcmVjYXRlZC4nKTtcbiAgICByZXR1cm4gdGhpcy52ckRpc3BsYXlzO1xuICB9O1xuXG4gIGdldFN0YW5kaW5nTWF0cml4KCkge1xuICAgIHJldHVybiB0aGlzLnN0YW5kaW5nTWF0cml4O1xuICB9O1xuXG4gIHVwZGF0ZSgpIHtcbiAgICBjb25zdCBjYW1lcmEgPSB0aGlzLmNhbWVyYTtcblxuICAgIGlmICh0aGlzLnZyRGlzcGxheSkge1xuICAgICAgbGV0IHBvc2U7XG4gICAgICBpZiAodGhpcy52ckRpc3BsYXkuZ2V0RnJhbWVEYXRhKSB7XG4gICAgICAgIHRoaXMudnJEaXNwbGF5LmdldEZyYW1lRGF0YSh0aGlzLmZyYW1lRGF0YSk7XG4gICAgICAgIHBvc2UgPSB0aGlzLmZyYW1lRGF0YS5wb3NlO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLnZyRGlzcGxheS5nZXRQb3NlKSB7XG4gICAgICAgIHBvc2UgPSB0aGlzLnZyRGlzcGxheS5nZXRQb3NlKCk7XG4gICAgICB9XG4gICAgICBpZiAocG9zZS5vcmllbnRhdGlvbiAhPT0gbnVsbCkge1xuICAgICAgICBjYW1lcmEucXVhdGVybmlvbi5mcm9tQXJyYXkocG9zZS5vcmllbnRhdGlvbik7XG4gICAgICB9XG4gICAgICBpZiAocG9zZS5wb3NpdGlvbiAhPT0gbnVsbCkge1xuICAgICAgICBjYW1lcmEucG9zaXRpb24uZnJvbUFycmF5KHBvc2UucG9zaXRpb24pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2FtZXJhLnBvc2l0aW9uLnNldCgwLCAwLCAwKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLnN0YW5kaW5nKSB7XG4gICAgICAgIGlmICh0aGlzLnZyRGlzcGxheS5zdGFnZVBhcmFtZXRlcnMpIHtcbiAgICAgICAgICBjYW1lcmEudXBkYXRlTWF0cml4KCk7XG4gICAgICAgICAgdGhpcy5zdGFuZGluZ01hdHJpeC5mcm9tQXJyYXkodGhpcy52ckRpc3BsYXkuc3RhZ2VQYXJhbWV0ZXJzLnNpdHRpbmdUb1N0YW5kaW5nVHJhbnNmb3JtKTtcbiAgICAgICAgICBjYW1lcmEuYXBwbHlNYXRyaXgodGhpcy5zdGFuZGluZ01hdHJpeCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2FtZXJhLnBvc2l0aW9uLnNldFkoY2FtZXJhLnBvc2l0aW9uLnkgKyB0aGlzLnVzZXJIZWlnaHQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjYW1lcmEucG9zaXRpb24ubXVsdGlwbHlTY2FsYXIodGhpcy5zY2FsZSk7XG4gICAgfVxuICB9O1xuXG4gIGRpc3Bvc2UoKSB7XG4gICAgdGhpcy52ckRpc3BsYXkgPSBudWxsO1xuICB9O1xufTtcbiIsIi8qKlxuICogQGF1dGhvciBtcmRvb2IgLyBodHRwOi8vbXJkb29iLmNvbVxuICogQGF1dGhvciBNdWdlbjg3IC8gaHR0cHM6Ly9naXRodWIuY29tL011Z2VuODdcbiAqXG4gKiBCYXNlZCBvbiBAdG9qaXJvJ3MgdnItc2FtcGxlcy11dGlscy5qc1xuICovXG5cbmV4cG9ydCBjb25zdCBXRUJWUiA9IHtcblxuXHRpc0F2YWlsYWJsZTogZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc29sZS53YXJuKCAnV0VCVlI6IGlzQXZhaWxhYmxlKCkgaXMgYmVpbmcgZGVwcmVjYXRlZC4gVXNlIC5jaGVja0F2YWlsYWJpbGl0eSgpIGluc3RlYWQuJyApO1xuXHRcdHJldHVybiBuYXZpZ2F0b3IuZ2V0VlJEaXNwbGF5cyAhPT0gdW5kZWZpbmVkO1xuXG5cdH0sXG5cblx0Y2hlY2tBdmFpbGFiaWxpdHk6IGZ1bmN0aW9uICgpIHtcblxuXHRcdHJldHVybiBuZXcgUHJvbWlzZSggZnVuY3Rpb24oIHJlc29sdmUsIHJlamVjdCApIHtcblxuXHRcdFx0aWYgKCBuYXZpZ2F0b3IuZ2V0VlJEaXNwbGF5cyAhPT0gdW5kZWZpbmVkICkge1xuXG5cdFx0XHRcdG5hdmlnYXRvci5nZXRWUkRpc3BsYXlzKCkudGhlbiggZnVuY3Rpb24gKCBkaXNwbGF5cyApIHtcblxuXHRcdFx0XHRcdGlmICggZGlzcGxheXMubGVuZ3RoID09PSAwICkge1xuXG5cdFx0XHRcdFx0XHRyZWplY3QoICdXZWJWUiBzdXBwb3J0ZWQsIGJ1dCBubyBWUkRpc3BsYXlzIGZvdW5kLicgKTtcblxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0XHRcdHJlc29sdmUoKTtcblxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHR9ICk7XG5cblx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0cmVqZWN0KCAnWW91ciBicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgV2ViVlIuIFNlZSA8YSBocmVmPVwiaHR0cHM6Ly93ZWJ2ci5pbmZvXCI+d2VidnIuaW5mbzwvYT4gZm9yIGFzc2lzdGFuY2UuJyApO1xuXG5cdFx0XHR9XG5cblx0XHR9ICk7XG5cblx0fSxcblxuXHRnZXRWUkRpc3BsYXk6IGZ1bmN0aW9uICggb25EaXNwbGF5ICkge1xuXG5cdFx0aWYgKCAnZ2V0VlJEaXNwbGF5cycgaW4gbmF2aWdhdG9yICkge1xuXG5cdFx0XHRuYXZpZ2F0b3IuZ2V0VlJEaXNwbGF5cygpXG5cdFx0XHRcdC50aGVuKCBmdW5jdGlvbiAoIGRpc3BsYXlzICkge1xuXHRcdFx0XHRcdG9uRGlzcGxheSggZGlzcGxheXNbIDAgXSApO1xuXHRcdFx0XHR9ICk7XG5cblx0XHR9XG5cblx0fSxcblxuXHRnZXRNZXNzYWdlOiBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zb2xlLndhcm4oICdXRUJWUjogZ2V0TWVzc2FnZSgpIGlzIGJlaW5nIGRlcHJlY2F0ZWQuIFVzZSAuZ2V0TWVzc2FnZUNvbnRhaW5lciggbWVzc2FnZSApIGluc3RlYWQuJyApO1xuXG5cdFx0dmFyIG1lc3NhZ2U7XG5cblx0XHRpZiAoIG5hdmlnYXRvci5nZXRWUkRpc3BsYXlzICkge1xuXG5cdFx0XHRuYXZpZ2F0b3IuZ2V0VlJEaXNwbGF5cygpLnRoZW4oIGZ1bmN0aW9uICggZGlzcGxheXMgKSB7XG5cblx0XHRcdFx0aWYgKCBkaXNwbGF5cy5sZW5ndGggPT09IDAgKSBtZXNzYWdlID0gJ1dlYlZSIHN1cHBvcnRlZCwgYnV0IG5vIFZSRGlzcGxheXMgZm91bmQuJztcblxuXHRcdFx0fSApO1xuXG5cdFx0fSBlbHNlIHtcblxuXHRcdFx0bWVzc2FnZSA9ICdZb3VyIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCBXZWJWUi4gU2VlIDxhIGhyZWY9XCJodHRwOi8vd2VidnIuaW5mb1wiPndlYnZyLmluZm88L2E+IGZvciBhc3Npc3RhbmNlLic7XG5cblx0XHR9XG5cblx0XHRpZiAoIG1lc3NhZ2UgIT09IHVuZGVmaW5lZCApIHtcblxuXHRcdFx0dmFyIGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdFx0XHRjb250YWluZXIuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRcdFx0Y29udGFpbmVyLnN0eWxlLmxlZnQgPSAnMCc7XG5cdFx0XHRjb250YWluZXIuc3R5bGUudG9wID0gJzAnO1xuXHRcdFx0Y29udGFpbmVyLnN0eWxlLnJpZ2h0ID0gJzAnO1xuXHRcdFx0Y29udGFpbmVyLnN0eWxlLnpJbmRleCA9ICc5OTknO1xuXHRcdFx0Y29udGFpbmVyLmFsaWduID0gJ2NlbnRlcic7XG5cblx0XHRcdHZhciBlcnJvciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdFx0XHRlcnJvci5zdHlsZS5mb250RmFtaWx5ID0gJ3NhbnMtc2VyaWYnO1xuXHRcdFx0ZXJyb3Iuc3R5bGUuZm9udFNpemUgPSAnMTZweCc7XG5cdFx0XHRlcnJvci5zdHlsZS5mb250U3R5bGUgPSAnbm9ybWFsJztcblx0XHRcdGVycm9yLnN0eWxlLmxpbmVIZWlnaHQgPSAnMjZweCc7XG5cdFx0XHRlcnJvci5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnI2ZmZic7XG5cdFx0XHRlcnJvci5zdHlsZS5jb2xvciA9ICcjMDAwJztcblx0XHRcdGVycm9yLnN0eWxlLnBhZGRpbmcgPSAnMTBweCAyMHB4Jztcblx0XHRcdGVycm9yLnN0eWxlLm1hcmdpbiA9ICc1MHB4Jztcblx0XHRcdGVycm9yLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcblx0XHRcdGVycm9yLmlubmVySFRNTCA9IG1lc3NhZ2U7XG5cdFx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQoIGVycm9yICk7XG5cblx0XHRcdHJldHVybiBjb250YWluZXI7XG5cblx0XHR9XG5cblx0fSxcblxuXHRnZXRNZXNzYWdlQ29udGFpbmVyOiBmdW5jdGlvbiAoIG1lc3NhZ2UgKSB7XG5cblx0XHR2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0XHRjb250YWluZXIuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRcdGNvbnRhaW5lci5zdHlsZS5sZWZ0ID0gJzAnO1xuXHRcdGNvbnRhaW5lci5zdHlsZS50b3AgPSAnMCc7XG5cdFx0Y29udGFpbmVyLnN0eWxlLnJpZ2h0ID0gJzAnO1xuXHRcdGNvbnRhaW5lci5zdHlsZS56SW5kZXggPSAnOTk5Jztcblx0XHRjb250YWluZXIuYWxpZ24gPSAnY2VudGVyJztcblxuXHRcdHZhciBlcnJvciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdFx0ZXJyb3Iuc3R5bGUuZm9udEZhbWlseSA9ICdzYW5zLXNlcmlmJztcblx0XHRlcnJvci5zdHlsZS5mb250U2l6ZSA9ICcxNnB4Jztcblx0XHRlcnJvci5zdHlsZS5mb250U3R5bGUgPSAnbm9ybWFsJztcblx0XHRlcnJvci5zdHlsZS5saW5lSGVpZ2h0ID0gJzI2cHgnO1xuXHRcdGVycm9yLnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICcjZmZmJztcblx0XHRlcnJvci5zdHlsZS5jb2xvciA9ICcjMDAwJztcblx0XHRlcnJvci5zdHlsZS5wYWRkaW5nID0gJzEwcHggMjBweCc7XG5cdFx0ZXJyb3Iuc3R5bGUubWFyZ2luID0gJzUwcHgnO1xuXHRcdGVycm9yLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcblx0XHRlcnJvci5pbm5lckhUTUwgPSBtZXNzYWdlO1xuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZCggZXJyb3IgKTtcblxuXHRcdHJldHVybiBjb250YWluZXI7XG5cblx0fSxcblxuXHRnZXRCdXR0b246IGZ1bmN0aW9uICggZGlzcGxheSwgY2FudmFzICkge1xuXG5cdFx0aWYgKCAnVlJFZmZlY3QnIGluIFRIUkVFICYmIGRpc3BsYXkgaW5zdGFuY2VvZiBUSFJFRS5WUkVmZmVjdCApIHtcblxuXHRcdFx0Y29uc29sZS5lcnJvciggJ1dlYlZSLmdldEJ1dHRvbigpIG5vdyBleHBlY3RzIGEgVlJEaXNwbGF5LicgKTtcblx0XHRcdHJldHVybiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnYnV0dG9uJyApO1xuXG5cdFx0fVxuXG5cdFx0dmFyIGJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdidXR0b24nICk7XG5cdFx0YnV0dG9uLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHRidXR0b24uc3R5bGUubGVmdCA9ICdjYWxjKDUwJSAtIDUwcHgpJztcblx0XHRidXR0b24uc3R5bGUuYm90dG9tID0gJzIwcHgnO1xuXHRcdGJ1dHRvbi5zdHlsZS53aWR0aCA9ICcxMDBweCc7XG5cdFx0YnV0dG9uLnN0eWxlLmJvcmRlciA9ICcwJztcblx0XHRidXR0b24uc3R5bGUucGFkZGluZyA9ICc4cHgnO1xuXHRcdGJ1dHRvbi5zdHlsZS5jdXJzb3IgPSAncG9pbnRlcic7XG5cdFx0YnV0dG9uLnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICcjMDAwJztcblx0XHRidXR0b24uc3R5bGUuY29sb3IgPSAnI2ZmZic7XG5cdFx0YnV0dG9uLnN0eWxlLmZvbnRGYW1pbHkgPSAnc2Fucy1zZXJpZic7XG5cdFx0YnV0dG9uLnN0eWxlLmZvbnRTaXplID0gJzEzcHgnO1xuXHRcdGJ1dHRvbi5zdHlsZS5mb250U3R5bGUgPSAnbm9ybWFsJztcblx0XHRidXR0b24uc3R5bGUudGV4dEFsaWduID0gJ2NlbnRlcic7XG5cdFx0YnV0dG9uLnN0eWxlLnpJbmRleCA9ICc5OTknO1xuXG5cdFx0aWYgKCBkaXNwbGF5ICkge1xuXG5cdFx0XHRidXR0b24udGV4dENvbnRlbnQgPSAnRU5URVIgVlInO1xuXHRcdFx0YnV0dG9uLm9uY2xpY2sgPSBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdFx0ZGlzcGxheS5pc1ByZXNlbnRpbmcgPyBkaXNwbGF5LmV4aXRQcmVzZW50KCkgOiBkaXNwbGF5LnJlcXVlc3RQcmVzZW50KCBbIHsgc291cmNlOiBjYW52YXMgfSBdICk7XG5cblx0XHRcdH07XG5cblx0XHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAndnJkaXNwbGF5cHJlc2VudGNoYW5nZScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdFx0XHRidXR0b24udGV4dENvbnRlbnQgPSBkaXNwbGF5LmlzUHJlc2VudGluZyA/ICdFWElUIFZSJyA6ICdFTlRFUiBWUic7XG5cblx0XHRcdH0sIGZhbHNlICk7XG5cblx0XHR9IGVsc2Uge1xuXG5cdFx0XHRidXR0b24udGV4dENvbnRlbnQgPSAnTk8gVlIgRElTUExBWSc7XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gYnV0dG9uO1xuXG5cdH1cblxufTtcbiIsImltcG9ydCB7TG9vcCwgQ29udHJvbHNNb2R1bGUsIENhbWVyYUNvbXBvbmVudH0gZnJvbSAnd2hzJztcbmltcG9ydCB7UkVWSVNJT059IGZyb20gJ3RocmVlJztcblxuaW1wb3J0IHtWUkVmZmVjdH0gZnJvbSAnLi92ci9WUkVmZmVjdCc7XG5pbXBvcnQgVlJDb250cm9sc05hdGl2ZSBmcm9tICd0aHJlZS12cmNvbnRyb2xzLW1vZHVsZSc7XG5pbXBvcnQge1dFQlZSfSBmcm9tICcuL3ZyL1dlYlZSJztcblxuZXhwb3J0IHtcbiAgV0VCVlJcbn07XG5cbmV4cG9ydCBjbGFzcyBWUk1vZHVsZSB7XG4gIGNvbnN0cnVjdG9yKHBhcmFtcyA9IHt9KSB7XG4gICAgdGhpcy5wYXJhbXMgPSBPYmplY3QuYXNzaWduKHBhcmFtcywge1xuICAgICAgbWVzc2FnZTogdHJ1ZSxcbiAgICAgIGJ1dHRvbjogdHJ1ZVxuICAgIH0pO1xuXG4gICAgdGhpcy5zY2VuZSA9IG51bGw7XG4gICAgdGhpcy5jYW1lcmEgPSBudWxsO1xuICAgIHRoaXMuZWZmZWN0ID0gbnVsbDtcbiAgfVxuXG4gIG1hbmFnZXIobWFuYWdlcikge1xuICAgIG1hbmFnZXIuZGVmaW5lKCd2cicpO1xuXG4gICAgaWYgKFJFVklTSU9OID4gODYpIGNvbnNvbGUud2FybignUGxlYXNlIHVzZSBWUk1vZHVsZTIgZm9yIFRocmVlLmpzIF4wLjg3LjAgKHI4NyknKTtcblxuICAgIGNvbnN0IHJlbmRlcmluZyA9IG1hbmFnZXIudXNlKCdyZW5kZXJpbmcnKTtcbiAgICBjb25zdCByZW5kZXJlciA9IG1hbmFnZXIuZ2V0KCdyZW5kZXJlcicpO1xuXG4gICAgY29uc3QgcmVzaXplID0gbWFuYWdlci51c2UoJ3Jlc2l6ZScpO1xuXG4gICAgdGhpcy5lZmZlY3QgPSBuZXcgVlJFZmZlY3QocmVuZGVyZXIpO1xuXG4gICAgdGhpcy5zY2VuZSA9IG1hbmFnZXIuZ2V0KCdzY2VuZScpO1xuICAgIHRoaXMuY2FtZXJhID0gbWFuYWdlci5nZXQoJ2NhbWVyYScpO1xuXG4gICAgcmVuZGVyaW5nLmVmZmVjdCh0aGlzLmVmZmVjdCk7XG5cbiAgICAvLyBUT0RPOiBGaXggcmVzaXplLlxuXG4gICAgcmVzaXplLmFkZENhbGxiYWNrKCh3aWR0aCwgaGVpZ2h0KSA9PiB7XG4gICAgICB0aGlzLmVmZmVjdC5zZXRTaXplKCt3aWR0aCwgK2hlaWdodCk7XG4gICAgfSk7XG5cbiAgICAvLyBXRUJWUlxuICAgIGNvbnN0IHttZXNzYWdlLCBidXR0b259ID0gdGhpcy5wYXJhbXM7XG5cbiAgICBpZiAobWVzc2FnZSkgV0VCVlIuY2hlY2tBdmFpbGFiaWxpdHkoKS5jYXRjaChtZXNzYWdlID0+IHtcblx0XHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoV0VCVlIuZ2V0TWVzc2FnZUNvbnRhaW5lcihtZXNzYWdlKSk7XG5cdFx0fSk7XG5cbiAgICBpZiAoYnV0dG9uKSBXRUJWUi5nZXRWUkRpc3BsYXkoZGlzcGxheSA9PiB7XG4gICAgICBjb25zdCB2cmJ0biA9IFdFQlZSLmdldEJ1dHRvbihkaXNwbGF5LCByZW5kZXJlci5kb21FbGVtZW50KTtcbiAgICAgIHZyYnRuLmNsYXNzTmFtZSA9ICd2ci1idG4nO1xuXG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHZyYnRuKTtcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVlIyTW9kdWxlIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5kaXNwbGF5ID0gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBXRUJWUi5nZXRWUkRpc3BsYXkoZGlzcGxheSA9PiByZXNvbHZlKGRpc3BsYXkpKSk7XG4gIH1cblxuICBtYW5hZ2VyKG1hbmFnZXIpIHtcbiAgICBtYW5hZ2VyLmRlZmluZSgndnInKTtcblxuICAgIGNvbnN0IHJlbmRlcmVyID0gbWFuYWdlci5nZXQoJ3JlbmRlcmVyJyk7XG4gICAgcmVuZGVyZXIudnIuZW5hYmxlZCA9IHRydWU7XG4gICAgY29uc29sZS5sb2coUkVWSVNJT04pO1xuICAgIGNvbnNvbGUubG9nKDEpO1xuXG4gICAgdGhpcy5kaXNwbGF5LnRoZW4oZGlzcGxheSA9PiB7XG4gICAgICByZW5kZXJlci52ci5zZXREZXZpY2UoZGlzcGxheSk7XG5cbiAgICAgIGNvbnN0IHZyYnRuID0gV0VCVlIuZ2V0QnV0dG9uKGRpc3BsYXksIHJlbmRlcmVyLmRvbUVsZW1lbnQpO1xuICAgICAgdnJidG4uY2xhc3NOYW1lID0gJ3ZyLWJ0bic7XG5cbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodnJidG4pO1xuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBWUkNvbnRyb2xzIGV4dGVuZHMgQ29udHJvbHNNb2R1bGUge1xuICBjb25zdHJ1Y3Rvcih7b2JqZWN0LCBvbkVycm9yLCBpbnRlbnNpdHl9KSB7XG4gICAgY29uc3QgY29udHJvbHMgPSBuZXcgVlJDb250cm9sc05hdGl2ZShvYmplY3QubmF0aXZlLCBvbkVycm9yKTtcblxuICAgIGNvbnRyb2xzLnN0YW5kaW5nID0gdHJ1ZTtcbiAgICBjb250cm9scy5zY2FsZSA9IGludGVuc2l0eTtcblxuICAgIHN1cGVyKHtjb250cm9sc30pO1xuICB9XG59XG4iXSwibmFtZXMiOlsiVlJFZmZlY3QiLCJyZW5kZXJlciIsIm9uRXJyb3IiLCJ2ckRpc3BsYXkiLCJ2ckRpc3BsYXlzIiwiZXllVHJhbnNsYXRpb25MIiwiVEhSRUUiLCJWZWN0b3IzIiwiZXllVHJhbnNsYXRpb25SIiwicmVuZGVyUmVjdEwiLCJyZW5kZXJSZWN0UiIsImZyYW1lRGF0YSIsIndpbmRvdyIsIlZSRnJhbWVEYXRhIiwiZ290VlJEaXNwbGF5cyIsImRpc3BsYXlzIiwibGVuZ3RoIiwibmF2aWdhdG9yIiwiZ2V0VlJEaXNwbGF5cyIsInRoZW4iLCJjYXRjaCIsIndhcm4iLCJpc1ByZXNlbnRpbmciLCJzY2FsZSIsInNjb3BlIiwicmVuZGVyZXJTaXplIiwiZ2V0U2l6ZSIsInJlbmRlcmVyVXBkYXRlU3R5bGUiLCJyZW5kZXJlclBpeGVsUmF0aW8iLCJnZXRQaXhlbFJhdGlvIiwiZ2V0VlJEaXNwbGF5Iiwic2V0VlJEaXNwbGF5IiwidmFsdWUiLCJzZXRTaXplIiwid2lkdGgiLCJoZWlnaHQiLCJ1cGRhdGVTdHlsZSIsImV5ZVBhcmFtc0wiLCJnZXRFeWVQYXJhbWV0ZXJzIiwic2V0UGl4ZWxSYXRpbyIsInJlbmRlcldpZHRoIiwicmVuZGVySGVpZ2h0IiwiY2FudmFzIiwiZG9tRWxlbWVudCIsInJlcXVlc3RGdWxsc2NyZWVuIiwiZXhpdEZ1bGxzY3JlZW4iLCJmdWxsc2NyZWVuRWxlbWVudCIsImRlZmF1bHRMZWZ0Qm91bmRzIiwiZGVmYXVsdFJpZ2h0Qm91bmRzIiwib25WUkRpc3BsYXlQcmVzZW50Q2hhbmdlIiwid2FzUHJlc2VudGluZyIsInVuZGVmaW5lZCIsImV5ZVdpZHRoIiwiZXllSGVpZ2h0IiwiYWRkRXZlbnRMaXN0ZW5lciIsInNldEZ1bGxTY3JlZW4iLCJib29sZWFuIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJFcnJvciIsInJlcXVlc3RQcmVzZW50Iiwic291cmNlIiwiZXhpdFByZXNlbnQiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJmIiwiY2FuY2VsQW5pbWF0aW9uRnJhbWUiLCJoIiwic3VibWl0RnJhbWUiLCJhdXRvU3VibWl0RnJhbWUiLCJjYW1lcmFMIiwiUGVyc3BlY3RpdmVDYW1lcmEiLCJsYXllcnMiLCJlbmFibGUiLCJjYW1lcmFSIiwicmVuZGVyIiwic2NlbmUiLCJjYW1lcmEiLCJyZW5kZXJUYXJnZXQiLCJmb3JjZUNsZWFyIiwiYXV0b1VwZGF0ZSIsInVwZGF0ZU1hdHJpeFdvcmxkIiwiZXllUGFyYW1zUiIsImZyb21BcnJheSIsIm9mZnNldCIsIkFycmF5IiwiaXNBcnJheSIsInNpemUiLCJnZXRMYXllcnMiLCJsZWZ0Qm91bmRzIiwicmlnaHRCb3VuZHMiLCJsYXllciIsIk1hdGgiLCJyb3VuZCIsInNldFJlbmRlclRhcmdldCIsInNjaXNzb3JUZXN0Iiwic2V0U2Npc3NvclRlc3QiLCJhdXRvQ2xlYXIiLCJjbGVhciIsInBhcmVudCIsIm1hdHJpeFdvcmxkIiwiZGVjb21wb3NlIiwicG9zaXRpb24iLCJxdWF0ZXJuaW9uIiwidHJhbnNsYXRlT25BeGlzIiwiZ2V0RnJhbWVEYXRhIiwiZGVwdGhOZWFyIiwibmVhciIsImRlcHRoRmFyIiwiZmFyIiwicHJvamVjdGlvbk1hdHJpeCIsImVsZW1lbnRzIiwibGVmdFByb2plY3Rpb25NYXRyaXgiLCJyaWdodFByb2plY3Rpb25NYXRyaXgiLCJmb3ZUb1Byb2plY3Rpb24iLCJmaWVsZE9mVmlldyIsInZpZXdwb3J0Iiwic2V0IiwieCIsInkiLCJzY2lzc29yIiwic2V0Vmlld3BvcnQiLCJzZXRTY2lzc29yIiwiZGlzcG9zZSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJmb3ZUb05EQ1NjYWxlT2Zmc2V0IiwiZm92IiwicHhzY2FsZSIsImxlZnRUYW4iLCJyaWdodFRhbiIsInB4b2Zmc2V0IiwicHlzY2FsZSIsInVwVGFuIiwiZG93blRhbiIsInB5b2Zmc2V0IiwiZm92UG9ydFRvUHJvamVjdGlvbiIsInJpZ2h0SGFuZGVkIiwiek5lYXIiLCJ6RmFyIiwiaGFuZGVkbmVzc1NjYWxlIiwibW9iaiIsIk1hdHJpeDQiLCJtIiwic2NhbGVBbmRPZmZzZXQiLCJ0cmFuc3Bvc2UiLCJERUcyUkFEIiwiUEkiLCJmb3ZQb3J0IiwidGFuIiwidXBEZWdyZWVzIiwiZG93bkRlZ3JlZXMiLCJsZWZ0RGVncmVlcyIsInJpZ2h0RGVncmVlcyIsIlZSQ29udHJvbHMiLCJXRUJWUiIsIm9uRGlzcGxheSIsIm1lc3NhZ2UiLCJjb250YWluZXIiLCJkb2N1bWVudCIsImNyZWF0ZUVsZW1lbnQiLCJzdHlsZSIsImxlZnQiLCJ0b3AiLCJyaWdodCIsInpJbmRleCIsImFsaWduIiwiZXJyb3IiLCJmb250RmFtaWx5IiwiZm9udFNpemUiLCJmb250U3R5bGUiLCJsaW5lSGVpZ2h0IiwiYmFja2dyb3VuZENvbG9yIiwiY29sb3IiLCJwYWRkaW5nIiwibWFyZ2luIiwiZGlzcGxheSIsImlubmVySFRNTCIsImFwcGVuZENoaWxkIiwiYnV0dG9uIiwiYm90dG9tIiwiYm9yZGVyIiwiY3Vyc29yIiwidGV4dEFsaWduIiwidGV4dENvbnRlbnQiLCJvbmNsaWNrIiwiVlJNb2R1bGUiLCJwYXJhbXMiLCJPYmplY3QiLCJhc3NpZ24iLCJlZmZlY3QiLCJtYW5hZ2VyIiwiZGVmaW5lIiwiUkVWSVNJT04iLCJjb25zb2xlIiwicmVuZGVyaW5nIiwidXNlIiwiZ2V0IiwicmVzaXplIiwiYWRkQ2FsbGJhY2siLCJjaGVja0F2YWlsYWJpbGl0eSIsImJvZHkiLCJnZXRNZXNzYWdlQ29udGFpbmVyIiwidnJidG4iLCJnZXRCdXR0b24iLCJjbGFzc05hbWUiLCJWUjJNb2R1bGUiLCJ2ciIsImVuYWJsZWQiLCJsb2ciLCJzZXREZXZpY2UiLCJvYmplY3QiLCJpbnRlbnNpdHkiLCJjb250cm9scyIsIlZSQ29udHJvbHNOYXRpdmUiLCJuYXRpdmUiLCJzdGFuZGluZyIsIkNvbnRyb2xzTW9kdWxlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUE7Ozs7Ozs7Ozs7O0FBV0EsQUFBTyxJQUFNQSxXQUFXLFNBQVhBLFFBQVcsQ0FBV0MsUUFBWCxFQUFxQkMsT0FBckIsRUFBK0I7O0tBRWxEQyxTQUFKLEVBQWVDLFVBQWY7S0FDSUMsa0JBQWtCLElBQUlDLE1BQU1DLE9BQVYsRUFBdEI7S0FDSUMs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
