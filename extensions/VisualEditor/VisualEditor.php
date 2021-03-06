<?php

/**
 * VisualEditor extension
 *
 * This PHP entry point is deprecated. Please use wfLoadExtension() and the extension.json file
 * instead. See https://www.mediawiki.org/wiki/Manual:Extension_registration for more details.
 *
 * @file
 * @ingroup Extensions
 * @copyright 2011-2015 VisualEditor Team and others; see AUTHORS.txt
 * @license The MIT License (MIT); see LICENSE.txt
 */

if ( function_exists( 'wfLoadExtension' ) ) {
	wfLoadExtension( 'VisualEditor' );

	// Keep i18n globals so mergeMessageFileList.php doesn't break
	$wgMessagesDirs['VisualEditor'] = array(
		__DIR__ . '/lib/ve/i18n',
		__DIR__ . '/modules/ve-mw/i18n',
		__DIR__ . '/modules/ve-wmf/i18n'
	);

	/* wfWarn(
	'Deprecated PHP entry point used for VisualEditor extension. Please use wfLoadExtension '.
	'instead, see https://www.mediawiki.org/wiki/Extension_registration for more details.'
	); */
	return true;
}

die( 'This version of the VisualEditor extension requires MediaWiki 1.25+.' );
