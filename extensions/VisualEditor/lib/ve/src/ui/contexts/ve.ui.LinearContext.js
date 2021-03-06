/*!
 * VisualEditor UserInterface Linear Context class.
 *
 * @copyright 2011-2015 VisualEditor Team and others; see http://ve.mit-license.org
 */

/**
 * UserInterface context.
 *
 * @class
 * @abstract
 * @extends ve.ui.Context
 *
 * @constructor
 * @param {ve.ui.Surface} surface
 * @param {Object} [config] Configuration options
 */
ve.ui.LinearContext = function VeUiLinearContext() {
	// Parent constructor
	ve.ui.LinearContext.super.apply( this, arguments );

	// Properties
	this.inspector = null;
	this.inspectors = this.createInspectorWindowManager();
	this.lastSelectedNode = null;
	this.afterContextChangeTimeout = null;
	this.afterContextChangeHandler = this.afterContextChange.bind( this );
	this.updateDimensionsDebounced = ve.debounce( this.updateDimensions.bind( this ) );

	// Events
	this.surface.getModel().connect( this, {
		contextChange: 'onContextChange',
		documentUpdate: 'onDocumentUpdate'
	} );
	this.inspectors.connect( this, { opening: 'onInspectorOpening' } );
};

/* Inheritance */

OO.inheritClass( ve.ui.LinearContext, ve.ui.Context );

/* Static Properties */

/**
 * Context items should show a delete button
 *
 * @static
 * @inheritable
 * @property {Object}
 */
ve.ui.LinearContext.static.showDeleteButton = false;

/* Methods */

/**
 * Check if context items should show a delete button
 *
 * @return {boolean} Context items should show a delete button
 */
ve.ui.LinearContext.prototype.showDeleteButton = function () {
	return this.constructor.static.showDeleteButton;
};

/**
 * Handle context change event.
 *
 * While an inspector is opening or closing, all changes are ignored so as to prevent inspectors
 * that change the selection from within their setup or teardown processes changing context state.
 *
 * The response to selection changes is deferred to prevent teardown processes handlers that change
 * the selection from causing this function to recurse. These responses are also debounced for
 * efficiency, so that if there are three selection changes in the same tick, #afterContextChange only
 * runs once.
 *
 * @see #afterContextChange
 */
ve.ui.LinearContext.prototype.onContextChange = function () {
	if ( this.inspector && ( this.inspector.isOpening() || this.inspector.isClosing() ) ) {
		// Cancel debounced change handler
		clearTimeout( this.afterContextChangeTimeout );
		this.afterContextChangeTimeout = null;
		this.lastSelectedNode = this.surface.getModel().getSelectedNode();
	} else {
		if ( this.afterContextChangeTimeout === null ) {
			// Ensure change is handled on next cycle
			this.afterContextChangeTimeout = setTimeout( this.afterContextChangeHandler );
		}
	}
	// Purge related items cache
	this.relatedSources = null;
};

/**
 * Handle document update event.
 */
ve.ui.LinearContext.prototype.onDocumentUpdate = function () {
	// Only mind this event if the menu is visible
	if ( this.isVisible() && !this.isEmpty() ) {
		// Reuse the debounced context change hanlder
		this.onContextChange();
	}
};

/**
 * Handle debounced context change events.
 */
ve.ui.LinearContext.prototype.afterContextChange = function () {
	var selectedNode = this.surface.getModel().getSelectedNode();

	// Reset debouncing state
	this.afterContextChangeTimeout = null;

	if ( this.isVisible() ) {
		if ( !this.isEmpty() ) {
			if ( this.isInspectable() ) {
				// Change state: menu -> menu
				this.teardownMenuItems();
				this.setupMenuItems();
				this.updateDimensionsDebounced();
			} else {
				// Change state: menu -> closed
				this.toggleMenu( false );
				this.toggle( false );
			}
		} else if (
			this.inspector &&
			( !selectedNode || ( selectedNode !== this.lastSelectedNode ) )
		) {
			// Change state: inspector -> (closed|menu)
			// Unless there is a selectedNode that hasn't changed (e.g. your inspector is editing a node)
			this.inspector.close();
		}
	} else {
		if ( this.isInspectable() ) {
			// Change state: closed -> menu
			this.toggleMenu( true );
			this.toggle( true );
		}
	}

	this.lastSelectedNode = selectedNode;
};

/**
 * Handle an inspector opening event.
 *
 * @param {OO.ui.Window} win Window that's being opened
 * @param {jQuery.Promise} opening Promise resolved when window is opened; when the promise is
 *   resolved the first argument will be a promise which will be resolved when the window begins
 *   closing, the second argument will be the opening data
 * @param {Object} data Window opening data
 */
ve.ui.LinearContext.prototype.onInspectorOpening = function ( win, opening ) {
	var context = this,
		observer = this.surface.getView().surfaceObserver;
	this.inspector = win;

	// Shut down the SurfaceObserver as soon as possible, so it doesn't get confused
	// by the selection moving around in IE. Will be reenabled when inspector closes.
	// FIXME this should be done in a nicer way, managed by the Surface classes
	observer.pollOnce();
	observer.stopTimerLoop();

	opening
		.progress( function ( data ) {
			if ( data.state === 'setup' ) {
				if ( !context.isVisible() ) {
					// Change state: closed -> inspector
					context.toggle( true );
				}
				if ( !context.isEmpty() ) {
					// Change state: menu -> inspector
					context.toggleMenu( false );
				}
			}
			context.updateDimensionsDebounced();
		} )
		.always( function ( opened ) {
			opened.always( function ( closed ) {
				closed.always( function () {
					var inspectable = context.isInspectable();

					context.inspector = null;

					// Reenable observer
					observer.startTimerLoop();

					if ( inspectable ) {
						// Change state: inspector -> menu
						context.toggleMenu( true );
						context.updateDimensionsDebounced();
					} else {
						// Change state: inspector -> closed
						context.toggle( false );
					}

					// Restore selection
					if ( context.getSurface().getModel().getSelection() ) {
						context.getSurface().getView().focus();
					}
				} );
			} );
		} );
};

/**
 * Check if context is visible.
 *
 * @return {boolean} Context is visible
 */
ve.ui.LinearContext.prototype.isVisible = function () {
	return this.visible;
};

/**
 * Check if current content is inspectable.
 *
 * @return {boolean} Content is inspectable
 */
ve.ui.LinearContext.prototype.isInspectable = function () {
	return !!this.getRelatedSources().length;
};

/**
 * @inheritdoc
 */
ve.ui.LinearContext.prototype.getRelatedSources = function () {
	var i, len, toolClass, items, tools, models, selectedNode,
		surfaceModel = this.surface.getModel(),
		selection = surfaceModel.getSelection(),
		selectedModels = [];

	if ( !this.relatedSources ) {
		this.relatedSources = [];
		if ( selection instanceof ve.dm.LinearSelection ) {
			selectedModels = this.surface.getView().getSelectedModels();
		} else if ( selection instanceof ve.dm.TableSelection ) {
			selectedModels = [ surfaceModel.getSelectedNode() ];
		}
		if ( selectedModels.length ) {
			models = [];
			items = ve.ui.contextItemFactory.getRelatedItems( selectedModels );
			for ( i = 0, len = items.length; i < len; i++ ) {
				if ( !items[ i ].model.isInspectable() ) {
					continue;
				}
				if ( ve.ui.contextItemFactory.isExclusive( items[ i ].name ) ) {
					models.push( items[ i ].model );
				}
				this.relatedSources.push( {
					type: 'item',
					embeddable: ve.ui.contextItemFactory.isEmbeddable( items[ i ].name ),
					name: items[ i ].name,
					model: items[ i ].model
				} );
			}
			tools = ve.ui.toolFactory.getRelatedItems( selectedModels );
			for ( i = 0, len = tools.length; i < len; i++ ) {
				if ( !tools[ i ].model.isInspectable() ) {
					continue;
				}
				if ( models.indexOf( tools[ i ].model ) === -1 ) {
					toolClass = ve.ui.toolFactory.lookup( tools[ i ].name );
					this.relatedSources.push( {
						type: 'tool',
						embeddable: !toolClass ||
							!( toolClass.prototype instanceof ve.ui.InspectorTool ),
						name: tools[ i ].name,
						model: tools[ i ].model
					} );
				}
			}
			if ( !this.relatedSources.length ) {
				selectedNode = surfaceModel.getSelectedNode();
				// For now we only need alien contexts to show the delete button
				if ( selectedNode && selectedNode.isFocusable() && this.showDeleteButton() ) {
					this.relatedSources.push( {
						type: 'item',
						embeddable: ve.ui.contextItemFactory.isEmbeddable( 'alien' ),
						name: 'alien',
						model: selectedNode
					} );
				}
			}
		}
	}

	return this.relatedSources;
};

/**
 * Get inspector window set.
 *
 * @return {ve.ui.WindowManager}
 */
ve.ui.LinearContext.prototype.getInspectors = function () {
	return this.inspectors;
};

/**
 * Create a inspector window manager.
 *
 * @method
 * @abstract
 * @return {ve.ui.WindowManager} Inspector window manager
 */
ve.ui.LinearContext.prototype.createInspectorWindowManager = null;

/**
 * @inheritdoc
 */
ve.ui.LinearContext.prototype.destroy = function () {
	// Disconnect events
	this.inspectors.disconnect( this );

	// Destroy inspectors WindowManager
	this.inspectors.destroy();

	// Stop timers
	clearTimeout( this.afterContextChangeTimeout );

	// Parent method
	return ve.ui.LinearContext.super.prototype.destroy.call( this );
};
