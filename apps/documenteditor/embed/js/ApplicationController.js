/*
 *
 * (c) Copyright Ascensio System Limited 2010-2016
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation. In accordance with
 * Section 7(a) of the GNU AGPL its Section 15 shall be amended to the effect
 * that Ascensio System SIA expressly excludes the warranty of non-infringement
 * of any third-party rights.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR  PURPOSE. For
 * details, see the GNU AGPL at: http://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA at Lubanas st. 125a-25, Riga, Latvia,
 * EU, LV-1021.
 *
 * The  interactive user interfaces in modified source and object code versions
 * of the Program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU AGPL version 3.
 *
 * Pursuant to Section 7(b) of the License you must retain the original Product
 * logo when distributing the program. Pursuant to Section 7(e) we decline to
 * grant you any rights under trademark law for use of our trademarks.
 *
 * All the Product's GUI elements, including illustrations and icon sets, as
 * well as technical writing content are licensed under the terms of the
 * Creative Commons Attribution-ShareAlike 4.0 International. See the License
 * terms at http://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
*/
var ApplicationController = new(function(){
    var me,
        api,
        config = {},
        docConfig = {},
        embedConfig = {},
        permissions = {},
        maxPages = 0,
        minToolbarWidth = 550,
        minEmbedWidth = 400,
        minEmbedHeight = 600,
        embedCode = '<iframe allowtransparency="true" frameborder="0" scrolling="no" src="{embed-url}" width="{width}" height="{height}"></iframe>',
        maxZIndex = 9090,
        created = false,
        iframePrint = null;

    // Initialize analytics
    // -------------------------

//    Common.Analytics.initialize('UA-12442749-13', 'Embedded ONLYOFFICE Document');


    // Check browser
    // -------------------------

    if (typeof isBrowserSupported !== 'undefined' && !isBrowserSupported()){
        Common.Gateway.reportError(undefined, 'Your browser is not supported.');
        return;
    }


    // Initialize ZeroClipboard
    // -------------------------

    ZeroClipboard.setMoviePath('../../../vendor/ZeroClipboard/ZeroClipboard10.swf');
    var clipShortUrl = new ZeroClipboard.Client();
    var clipEmbedObj = new ZeroClipboard.Client();
    clipShortUrl.zIndex = maxZIndex;
    clipEmbedObj.zIndex = maxZIndex;


    // Utils
    // -------------------------

    function emptyFn(){}

    function htmlEncode(value){
        return $('<div/>').text(value).html();
    }

    function createBuffered(fn, buffer, scope, args) {
        return function(){
            var timerId;
            return function() {
                var me = this;
                if (timerId) {
                    clearTimeout(timerId);
                    timerId = null;
                }
                timerId = setTimeout(function(){
                    fn.apply(scope || me, args || arguments);
                }, buffer);
            };
        }();
    }

    function updateSocial() {
        var $socialPanel = $('#id-popover-social-container');

        if ($socialPanel.length > 0) {
            if ($socialPanel.attr('data-loaded') == 'false') {
                typeof FB !== 'undefined' && FB.XFBML && FB.XFBML.parse();
                typeof twttr !== 'undefined' && twttr.widgets && twttr.widgets.load();

                $socialPanel.attr('data-loaded', 'true');
            }
        }
    }


    // Handlers
    // -------------------------

    function loadConfig(data) {
        config = $.extend(config, data.config);
        embedConfig = $.extend(embedConfig, data.config.embedded);

        $('#id-short-url').val(embedConfig.shareUrl || 'Unavailable');
        $('#id-textarea-embed').text(embedCode.replace('{embed-url}', embedConfig.embedUrl).replace('{width}', minEmbedWidth).replace('{height}', minEmbedHeight));

        if (typeof embedConfig.shareUrl !== 'undefined' && embedConfig.shareUrl != ''){
            (function(d, s, id) {
                  var js, fjs = d.getElementsByTagName(s)[0];
                  if (d.getElementById(id)) return;
                  js = d.createElement(s); js.id = id;
                  js.src = "//connect.facebook.net/en_US/all.js#xfbml=1";
                  fjs.parentNode.insertBefore(js, fjs);
            }(document, 'script', 'facebook-jssdk'));
            !function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0];if(!d.getElementById(id)){js=d.createElement(s);js.id=id;js.src="//platform.twitter.com/widgets.js";fjs.parentNode.insertBefore(js,fjs);}}(document,"script","twitter-wjs");

            if ($('#id-popover-social-container ul')){
                $('#id-popover-social-container ul').append('<li><div class="fb-like" data-href="' + embedConfig.shareUrl + '" data-send="false" data-layout="button_count" data-width="450" data-show-faces="false"></div></li>');
                $('#id-popover-social-container ul').append('<li class="share-twitter"><a href="https://twitter.com/share" class="twitter-share-button" data-url="' + embedConfig.shareUrl + '">Tweet</a></li>'); //data-count="none"
                $('#id-popover-social-container ul').append('<li class="share-mail"><a class="btn btn-xs btn-default" href="mailto:?subject=I have shared a document with you: ' + embedConfig.docTitle + '&body=I have shared a document with you: ' + embedConfig.shareUrl + '"><span class="glyphicon glyphicon-envelope"></span>Email</a></li>');
            }
        }
        if (typeof embedConfig.shareUrl === 'undefined')
            $('#id-btn-share').hide();

        if (typeof embedConfig.embedUrl === 'undefined')
            $('#id-btn-embed').hide();

        if (typeof embedConfig.fullscreenUrl === 'undefined')
            $('#id-btn-fullscreen').hide();

        if (config.canBackToFolder === false || !(config.customization && config.customization.goback && config.customization.goback.url))
            $('#id-btn-close').hide();


        // Docked toolbar
        if (embedConfig.toolbarDocked === 'top') {
            $('#toolbar').addClass('top');
            $('#editor_sdk').addClass('top');
        } else {
            $('#toolbar').addClass('bottom');
            $('#editor_sdk').addClass('bottom');
        }

        // Hide last separator
        if (!$('#id-btn-fullscreen').is(":visible") && !$('#id-btn-close').is(":visible")) {
            $('#toolbar .right .separator').hide();
            $('#pages').css('margin-right', '12px');
        }
    }

    function loadDocument(data) {
        docConfig = data.doc;

        if (docConfig) {
            permissions = $.extend(permissions, docConfig.permissions);

            var docInfo = new Asc.asc_CDocInfo();
            docInfo.put_Id(docConfig.key);
            docInfo.put_Url(docConfig.url);
            docInfo.put_Title(docConfig.title);
            docInfo.put_Format(docConfig.fileType);
            docInfo.put_VKey(docConfig.vkey);

            if (api) {
                api.asc_registerCallback('asc_onGetEditorPermissions', onEditorPermissions);
                api.asc_setDocInfo(docInfo);
                api.asc_getEditorPermissions(config.licenseUrl, config.customerId);
                api.asc_enableKeyEvents(true);

                Common.Analytics.trackEvent('Load', 'Start');
            }

            if (typeof embedConfig.saveUrl === 'undefined' && permissions.print === false)
                $('#id-btn-copy').hide();

            if (!$('#id-btn-copy').is(":visible") && !$('#id-btn-share').is(":visible") && !$('#id-btn-embed').is(":visible") )
                $('#toolbar .left .separator').hide();
        }
    }

    function onCountPages(count) {
        maxPages = count;
        $('#pages').text('of ' + count);
    }

    function onCurrentPage(number) {
        $('#page-number').val(number + 1);
    }

    function onHyperlinkClick(url) {
        if (url) {
            var newDocumentPage = window.open(url, '_blank');
            if (newDocumentPage)
                newDocumentPage.focus();
        }
    }

    function onLongActionBegin(type, id) {
        var text = '';
        switch (id)
        {
            case Asc.c_oAscAsyncAction['Print']:
                text = 'Downloading document...';
                break;
            default:
                text = 'Please wait...';
                break;
        }

        if (type == Asc.c_oAscAsyncActionType['BlockInteraction']) {
            $('#id-loadmask .cmd-loader-title').html(text);
            showMask();
        }
    }

    function onLongActionEnd(){
        hideMask();
    }

    function onDocMouseMoveStart() {
        me.isHideBodyTip = true;
    }

    function onDocMouseMoveEnd() {
        if (me.isHideBodyTip) {
            var $tipHyperlink = $('#id-tip-hyperlink');

            if ($tipHyperlink.length > 0) {
                $tipHyperlink.hide();
            }
        }
    }

    function onDocMouseMove(data) {
        if (data) {
            if (data.get_Type() == 1) { // hyperlink
                me.isHideBodyTip = false;

                var $tipHyperlink   = $('#id-tip-hyperlink'),
                    hyperProps      = data.get_Hyperlink(),
                    toolTip         = (hyperProps.get_ToolTip()) ? hyperProps.get_ToolTip() : hyperProps.get_Value();

                if ($tipHyperlink.length > 0) {
                    $tipHyperlink.find('.popover-content p').html(htmlEncode(toolTip) + '<br><b>Press Ctrl and click link</b>');
                    $tipHyperlink.show();
                }

                $tipHyperlink.css({
                    left: data.get_X() - 10,
                    top : data.get_Y() - 25
                })
            }
        }
    }

    function onDownloadUrl(url) {
        Common.Gateway.downloadAs(url);
    }

    function onPrint() {
        if (api && permissions.print!==false)
            api.asc_Print($.browser.chrome || $.browser.safari || $.browser.opera);
    }

    function onPrintUrl(url) {
        if (iframePrint) {
            iframePrint.parentNode.removeChild(iframePrint);
            iframePrint = null;
        }
        if (!iframePrint) {
            iframePrint = document.createElement("iframe");
            iframePrint.id = "id-print-frame";
            iframePrint.style.display = 'none';
            iframePrint.style.visibility = "hidden";
            iframePrint.style.position = "fixed";
            iframePrint.style.right = "0";
            iframePrint.style.bottom = "0";
            document.body.appendChild(iframePrint);
            iframePrint.onload = function() {
                iframePrint.contentWindow.focus();
                iframePrint.contentWindow.print();
                iframePrint.contentWindow.blur();
                window.focus();
            };
        }
        if (url) iframePrint.src = url;
    }

    function hidePreloader() {
        $('#loading-mask').fadeOut('slow');
    }

    function onDocumentContentReady() {
        setVisiblePopover($('#id-popover-share'), false);
        setVisiblePopover($('#id-popover-embed'), false);
        $('#id-tip-hyperlink').hide();

        handlerToolbarSize();
        hidePreloader();
        
        //$("#btn-zoom-towidth").click();
        $("#btn-zoom-topage").click();
        
        Common.Analytics.trackEvent('Load', 'Complete');
    }

    function onEditorPermissions(params) {
        if ( params.asc_getCanBranding() && (typeof config.customization == 'object') &&
             config.customization && config.customization.logo ) {

            var logo = $('#header-logo');
            if (config.customization.logo.imageEmbedded) {
                logo.html('<img src="'+config.customization.logo.imageEmbedded+'" style="max-width:124px; max-height:20px;"/>');
                logo.css({'background-image': 'none', width: 'auto', height: 'auto'});
            }

            if (config.customization.logo.url) {
                logo.attr('href', config.customization.logo.url);
            }
        }
        api.asc_setViewMode(true);
        api.asc_LoadDocument();
        api.Resize();
        api.zoomFitToWidth();
    }

    function showMask() {
        $('#id-loadmask').modal({
            backdrop: 'static',
            keyboard: false
        });
    }

    function hideMask() {
        $('#id-loadmask').modal('hide');
    }

    function onOpenDocument(progress) {
        var proc = (progress.asc_getCurrentFont() + progress.asc_getCurrentImage())/(progress.asc_getFontsCount() + progress.asc_getImagesCount());
        $('#loadmask-text').html('Loading document: ' + Math.min(Math.round(proc * 100), 100) + '%');
    }

    function onError(id, level, errData) {
        hidePreloader();

        var message;

        switch (id)
        {
            case Asc.c_oAscError.ID.Unknown:
                message = me.unknownErrorText;
                break;

            case Asc.c_oAscError.ID.ConvertationTimeout:
                message = me.convertationTimeoutText;
                break;

            case Asc.c_oAscError.ID.ConvertationError:
                message = me.convertationErrorText;
                break;

            case Asc.c_oAscError.ID.DownloadError:
                message = me.downloadErrorText;
                break;

            default:
                message = me.errorDefaultMessage.replace('%1', id);
                break;
        }

        if (level == Asc.c_oAscError.Level.Critical) {

            // report only critical errors
            Common.Gateway.reportError(id, message);

            $('#id-critical-error-title').text(me.criticalErrorTitle);
            $('#id-critical-error-message').text(message);
            $('#id-critical-error-close').off();
            $('#id-critical-error-close').on('click', function(){
                window.location.reload();
            });
        }
        else {
            $('#id-critical-error-title').text(me.notcriticalErrorTitle);
            $('#id-critical-error-message').text(message);
            $('#id-critical-error-close').off();
            $('#id-critical-error-close').on('click', function(){
                $('#id-critical-error-dialog').modal('hide');
            });
        }

        $('#id-critical-error-dialog').modal('show');

        Common.Analytics.trackEvent('Internal Error', id.toString());
    }

    function onExternalError(error) {
        if (error) {
            hidePreloader();
            $('#id-error-mask-title').text(error.title);
            $('#id-error-mask-text').text(error.msg);
            $('#id-error-mask').css('display', 'block');

            Common.Analytics.trackEvent('External Error', error.title);
        }
    }

    function onProcessMouse(data) {
        if (data.type == 'mouseup') {
            var e = document.getElementById('editor_sdk');
            if (e) {
                var r = e.getBoundingClientRect();
                api.OnMouseUp(
                    data.x - r.left,
                    data.y - r.top
                );
            }
        }
    }

    function onDownloadAs() {
        if (api) api.asc_DownloadAs(Asc.c_oAscFileType.DOCX, true);
    }

    // Helpers
    // -------------------------

    var handlerToolbarSize = createBuffered(function(size){
        var visibleCaption = function(btn, visible){
            if (visible){
                $(btn + ' button').addClass('no-caption');
                $(btn + ' button span').css('display', 'none');
            } else {
                $(btn + ' button').removeClass('no-caption');
                $(btn + ' button span').css('display', 'inline');
            }
        };

        var isMinimize = $('#toolbar').width() < minToolbarWidth;

        visibleCaption('#id-btn-copy',  isMinimize);
        visibleCaption('#id-btn-share', isMinimize);
        visibleCaption('#id-btn-embed', isMinimize);
    }, 10);

    function onDocumentResize() {
        if (api)
            api.Resize();

        handlerToolbarSize();
    }

    function isVisiblePopover(popover){
        return popover.hasClass('in');
    }

    function setVisiblePopover(popover, visible, owner){
        api && api.asc_enableKeyEvents(!visible);

        if (visible){
            if (owner){
                popover.css('display', 'block');

                var popoverData     = owner.data('bs.popover'),
                    $tip            = popoverData.tip(),
                    pos             = popoverData.getPosition(false),
                    actualHeight    = $tip[0].offsetHeight,
                    placement       = (embedConfig.toolbarDocked === 'top') ? 'bottom' : 'top',
                    tp;

                $tip.removeClass('fade in top bottom left right');

                switch (placement) {
                    case 'bottom':
                        tp = {
                            top : pos.top + pos.height,
                            left: owner.position().left + (owner.width() - popover.width()) * 0.5
                        };
                        break;

                    default:
                    case 'top':
                        tp = {
                            top : pos.top - actualHeight,
                            left: owner.position().left + (owner.width() - popover.width()) * 0.5
                        };
                        break;

                }

                $tip
                    .css(tp)
                    .addClass(placement)
                    .addClass('in')
            }

            if (popover.hasClass('embed')) {
                clipEmbedObj.show();
            }

            if (popover.hasClass('share')) {
                clipShortUrl.show();
                updateSocial();
            }
        } else {
            popover.removeClass('in');
            popover.css('display', 'none');

            popover.hasClass('embed') && clipEmbedObj.hide();
            popover.hasClass('share') && clipShortUrl.hide();
        }
    }

    function updateEmbedCode(){
        var newWidth  = parseInt($('#id-input-embed-width').val()),
            newHeight = parseInt($('#id-input-embed-height').val());

        if (newWidth < minEmbedWidth)
            newWidth = minEmbedWidth;

        if (newHeight < minEmbedHeight)
            newHeight = minEmbedHeight;

        $('#id-textarea-embed').text(embedCode.replace('{embed-url}', embedConfig.embedUrl).replace('{width}', newWidth).replace('{height}', newHeight));

        $('#id-input-embed-width').val(newWidth + 'px');
        $('#id-input-embed-height').val(newHeight + 'px');
    }

    function openLink(url){
        var newDocumentPage = window.open(url);
        if (newDocumentPage)
            newDocumentPage.focus();
    }

    function createController(){
        if (created)
            return me;

        me = this;
        created = true;

        var documentMoveTimer;

        // Initialize clipboard objects

        clipShortUrl.addEventListener('mousedown', function() {
            if ($('#id-btn-copy-short').hasClass('copied'))
                return;

            $('#id-btn-copy-short').button('copied');
            $('#id-btn-copy-short').addClass('copied');

            clipShortUrl.setText($('#id-short-url').val());

            setTimeout(function(){
                $('#id-btn-copy-short').button('reset');
                $('#id-btn-copy-short').removeClass('copied');
            }, 2000);
        });

        clipEmbedObj.addEventListener('mousedown', function(){
            if ($('#id-btn-copy-embed').hasClass('copied'))
                return;

            $('#id-btn-copy-embed').button('copied');
            $('#id-btn-copy-embed').addClass('copied');

            clipEmbedObj.setText($('#id-textarea-embed').text());

            setTimeout(function(){
                $('#id-btn-copy-embed').button('reset');
                $('#id-btn-copy-embed').removeClass('copied');
            }, 2000);
        });

        clipShortUrl.glue('id-btn-copy-short');
        clipEmbedObj.glue('id-btn-copy-embed');


        // popover ui handlers

        $('#id-btn-copy').on('click', function(){
            var saveUrl = embedConfig.saveUrl;
            if (typeof saveUrl !== 'undefined' && saveUrl.length > 0){
                openLink(saveUrl);
            } else if (api && permissions.print!==false){
                api.asc_Print($.browser.chrome || $.browser.safari || $.browser.opera);
            }

            Common.Analytics.trackEvent('Save');
        });

        $('#id-btn-share').on('click', function(event){
            setVisiblePopover($('#id-popover-share'), !isVisiblePopover($('#id-popover-share')), $('#id-btn-share'));
            setVisiblePopover($('#id-popover-embed'), false);

            event.preventDefault();
            event.stopPropagation();
        });

        $('#id-btn-embed').on('click', function(event){
            setVisiblePopover($('#id-popover-embed'), !isVisiblePopover($('#id-popover-embed')), $('#id-btn-embed'));
            setVisiblePopover($('#id-popover-share'), false);

            event.preventDefault();
            event.stopPropagation();
        });

        $('#id-input-embed-width').on('keypress', function(e){
            if (e.keyCode == 13)
                updateEmbedCode();
        });

        $('#id-input-embed-height').on('keypress', function(e){
            if (e.keyCode == 13)
                updateEmbedCode();
        });

        $('#id-input-embed-width').on('focusin', function(e){
            api && api.asc_enableKeyEvents(false);
        });

        $('#id-input-embed-height').on('focusin', function(e){
            api && api.asc_enableKeyEvents(false);
        });

        $('#id-input-embed-width').on('focusout', function(e){
            updateEmbedCode();
            api && api.asc_enableKeyEvents(true);
        });

        $('#id-input-embed-height').on('focusout', function(e){
            updateEmbedCode();
            api && api.asc_enableKeyEvents(true);
        });

        $('#page-number').on('keyup', function(e){
            if (e.keyCode == 13){
                var newPage = parseInt($('#page-number').val());

                if (newPage > maxPages)
                    newPage = maxPages;
                if (newPage < 2 || isNaN(newPage))
                    newPage = 1;

                if (api)
                    api.goToPage(newPage-1);
            }
        });

        $('#page-number').on('focusout', function(e){
            api && api.asc_enableKeyEvents(true);
        });

        $('#id-btn-fullscreen').on('click', function(){
            openLink(embedConfig.fullscreenUrl);
        });

        $('#id-btn-close').on('click', function(){
            if (config.customization && config.customization.goback && config.customization.goback.url)
                window.parent.location.href = config.customization.goback.url;
        });

        $('#id-btn-zoom-in').on('click', function(){
            if (api)
                api.zoomIn();
        });

        $('#id-btn-zoom-out').on('click', function(){
            if (api)
                api.zoomOut();
        });

        $(window).resize(function(){
            onDocumentResize();
        });

        $(document).click(function(event){
            if (event && event.target && $(event.target).closest('.popover').length > 0)
                return;

            setVisiblePopover($('#id-popover-share'), false);
            setVisiblePopover($('#id-popover-embed'), false);
        });

        $(document).mousemove(function(event){
            $('#id-btn-zoom-in').fadeIn();
            $('#id-btn-zoom-out').fadeIn();

            clearTimeout(documentMoveTimer);
            documentMoveTimer = setTimeout(function(){
                $('#id-btn-zoom-in').fadeOut();
                $('#id-btn-zoom-out').fadeOut();
            }, 2000);
        });

        window["flat_desine"] = true;
        api = new Asc.asc_docs_api({
            'id-view'  : 'editor_sdk'
        });

        if (api){
            api.asc_registerCallback('asc_onError',                 onError);
            api.asc_registerCallback('asc_onDocumentContentReady',  onDocumentContentReady);
            api.asc_registerCallback('asc_onOpenDocumentProgress',  onOpenDocument);
            api.asc_registerCallback('asc_onCountPages',            onCountPages);
//            api.asc_registerCallback('OnCurrentVisiblePage',    onCurrentPage);
            api.asc_registerCallback('asc_onCurrentPage',           onCurrentPage);
            api.asc_registerCallback('asc_onHyperlinkClick',        onHyperlinkClick);
            api.asc_registerCallback('asc_onStartAction',           onLongActionBegin);
            api.asc_registerCallback('asc_onEndAction',             onLongActionEnd);

            api.asc_registerCallback('asc_onMouseMoveStart',        onDocMouseMoveStart);
            api.asc_registerCallback('asc_onMouseMoveEnd',          onDocMouseMoveEnd);
            api.asc_registerCallback('asc_onMouseMove',             onDocMouseMove);

            api.asc_registerCallback('asc_onDownloadUrl',           onDownloadUrl);
            api.asc_registerCallback('asc_onPrint',                 onPrint);
            api.asc_registerCallback('asc_onPrintUrl',              onPrintUrl);

            // Initialize api gateway
            Common.Gateway.on('init',               loadConfig);
            Common.Gateway.on('opendocument',       loadDocument);
            Common.Gateway.on('showerror',          onExternalError);
            Common.Gateway.on('processmouse',       onProcessMouse);
            Common.Gateway.on('downloadas',         onDownloadAs);
            Common.Gateway.ready();
        }

        return me;
    }

    return {
        create                  : createController,
        errorDefaultMessage     : 'Error code: %1',
        unknownErrorText        : 'Unknown error.',
        convertationTimeoutText : 'Convertation timeout exceeded.',
        convertationErrorText   : 'Convertation failed.',
        downloadErrorText       : 'Download failed.',
        criticalErrorTitle      : 'Error',
        notcriticalErrorTitle   : 'Warning'
    }
})();
