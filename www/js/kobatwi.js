var kobatwi;

(function(){

/*
 *  Utility function
 */
function dateStr(str) {
    var date = new Date(str);
    var now  = new Date();
    var elapseSec = Math.floor((now - date) / 1000);

    if (elapseSec < 60) return 'now';
    if (elapseSec < 60*60) return - Math.floor(elapseSec / 60) + 'm';
    var datestr =   ('0' + date.getHours()).slice(-2)
            + ':' + ('0' + date.getMinutes()).slice(-2);
    if (elapseSec > 60*60*24)
        datestr =   ('0' + (date.getMonth() + 1)).slice(-2)
            + '/' + ('0' + date.getDate()).slice(-2)
            + ' ' + datestr;
    if (elapseSec > 60*60*24*365/2)
        datestr = date.getFullYear() + '/' + datestr;
    return datestr;
}
function extId(id, baseId) {
    return (baseId.replace(/./g, ' ') + id).slice(-baseId.length);
}
function spliceText(src, from, to, replace) {
    var text = new String(src);
    return text.slice(0, from) + replace + text.slice(to);
}

/*
 *  URL of Twitter API
 */
var apiBaseUrl  = 'proxy/';
var apiAccount  = apiBaseUrl + 'account/verify_credentials.json';
var apiTweet    = apiBaseUrl + 'statuses/update.json';
var apiHomeTL   = apiBaseUrl + 'statuses/home_timeline.json';
var apiMention  = apiBaseUrl + 'statuses/mentions_timeline.json';
var apiUserTL   = apiBaseUrl + 'statuses/user_timeline.json';

/*
 *  Setting DOM tenplate
 */
var template = {};

function init() {
    template.connecter = $('.connecter').remove().eq(0);
    template.status    = $('.status').remove().eq(0);
    showLoader();
}

/*
 *  Loader, Login and Main
 */
function showLoader() {
    $('#main, #login').hide();
    $('#loader').show();
}
function showLogin() {
    $('#main, #loader').hide();
    $('#login').show();
}
function showMain(user) {
    setMenubar(user);
    $('#loader, #login').hide();
    $('#main').show();
}

/*
 *  Menubar
 */
function setMenubar(user) {

    $('#menubar a[href="#user"] img')
        .attr('src', kobatwi.imageUrl(user.profile_image_url));

    $('#menubar a[href^=#]').click(function(){ return false });
    
    setPanel('#home');
    setPanel('#mention');
    setTweet();

    $('#menubar a[href="#home"]').click();
}

/*
 *  Tweet
 */
function setTweet() {
    
    var tweetForm = $('#tweet');

    tweetForm.hide();
    $('#tweet .textlen').text(140);

    $('#menubar a[href="#tweet"]').click(function(){
        if (tweetForm.css('display') == 'none') {
            tweetForm.find('.loading, .error').hide();
            tweetForm.find('.form').show();
            tweetForm.slideDown();
        }
        else tweetForm.slideUp();
        return false;
    });

    tweetForm.find('.error').click(function(){
        tweetForm.hide();
        $('#menubar a[href="#tweet"]').click();
    });
    
    var timeId;
    $('#tweet textarea').blur(function(){
        clearInterval(timeId);
    });
    $('#tweet textarea').focus(function(){
        timeId = setInterval(function(){
            var textlen = 140 - $('#tweet textarea').val().length;
            $('#tweet .textlen').text(textlen);
            if (textlen < 0) $('#tweet .textlen').addClass('exceed');
            else             $('#tweet .textlen').removeClass('exceed');
        }, 500);
    });

    $('#tweet input[type=button]').click(function(){
        var text = $('#tweet textarea').val();
        if (text == '') return false;
        tweetForm.find('.form').fadeOut('normal', function(){
            tweetForm.find('.loading').show();
        });
        kobatwi.tweet(text, {},
            function(){
                $('#tweet textarea').val('');
                tweetForm.slideUp('slow', function(){
                    $('#menubar a[href="#home"]').click();
                });
            },
            function(){
                tweetForm.find('.loading').hide();
                tweetForm.find('.error').show();
            }
        );
        return false;
    });
}

/*
 *  Panel
 */
function setPanel(type) {

    var panel = $(type);

    var connecter = newConnecter(type, {count: 20});
    panel.prepend(connecter);

    $('#menubar a[href="'+type+'"]').click(function(){
        $('#menubar a[href^=#]').removeClass('selected');
        $('#menubar a[href="'+type+'"]').addClass('selected');
        $('#tweet').slideUp(function(){
            $('#menubar').nextAll().hide();
            panel.show();
        });
        panel.find('.status').removeClass('new').trigger('update');
        connecter.slideDown().click();
        return false;
    });
}

/*
 *  Connecter and Timeline
 */
function newConnecter(type, params) {

    var connecter = template.connecter.clone();

    connecter.find('.ready, .loading, .error').hide();
    connecter.find('.ready').show();

    connecter.click(function(){
        connecter.find('.ready, .loading, .error').hide();
        connecter.find('.loading').show();
        kobatwi.getTimeline(connecter, type, params,
            setTimeline,
            function(){
                connecter.find('.ready, .loading, .error').hide();
                connecter.find('.error').show();            
            }
        );
    });
    return connecter;
}
function setTimeline(connecter, type, params, timeline) {

    if (timeline.length > 0
        && timeline[timeline.length - 1].id_str != params.since_id)
    {
        var newParams = {};
        for (var key in params) {
            newParams[key] = params[key];
        }
        newParams.max_id = timeline[timeline.length - 1].id_str;
        connecter.after(
            newConnecter(type, newParams)
        );
    }

    connecter.after(
        $.map(timeline, function(n){
            if (n.id_str == params.since_id) return null;
            return newStatus(type, n).addClass('new');
        })
    );

    if (params.max_id == null) {
        if (timeline.length > 0) params.since_id = timeline[0].id_str;
        connecter.slideUp('normal', function(){
            connecter.find('.ready, .loading, .error').hide();
            connecter.find('.ready').show();
        });
    }
    else {
        connecter.slideUp('normal', function(){
            connecter.remove();
        });
    }
}

/*
 *  Status
 */
function newStatus(type, data) {

    var status = template.status.clone();
    
    var retweet;
    if (data.retweeted_status == null || type == '#mention')
        status.find('.retweet').remove();
    else {
        retweet = data;
        data = data.retweeted_status;
    }    

    status.find('.user_image')
        .attr('src', kobatwi.imageUrl(data.user.profile_image_url));
    status.find('.user_name').html(data.user.name);
    status.find('.screen_name').html(data.user.screen_name);
    status.find('.text').html(insertEntities(data.text, data.entities));
    status.find('.date').text(dateStr(data.created_at));
    if (data.in_reply_to_status_id_str == null)
            status.find('a[href="#conversation"]').remove();

    if (retweet != null) {
        status.find('.retweet .user_image')
            .attr('src', kobatwi.imageUrl(retweet.user.profile_image_url));
        status.find('.retweet .user_name').html(retweet.user.name);
        status.find('.retweet .screen_name').html(retweet.user.screen_name);
    }

    if (data.entities.media != null)
        status.find('.media').append(
            $.map(data.entities.media, function(n){
                return $('<a target="_blank"></a>').attr('href',
                                kobatwi.imageUrl(n.media_url + ':medium'))
                            .append($('<img />').attr('src',
                                kobatwi.imageUrl(n.media_url + ':thumb')));
            })
        );
    
    var date = data.created_at;
    status.bind('update', function(){
        status.find('.date').text(dateStr(date));
    });

    status.find('a[href^=#]').click(function(){ return false });

    return status;
}
function insertEntities(text, entities) {
    var replace = entities.urls.slice(0);
    if (entities.media != null)
        replace = replace.concat(entities.media.slice(0));
    replace.sort(function(a, b){
        return b.indices[0] - a.indices[0];
    });
    $.each(replace, function(){
        text = spliceText(text, this.indices[0], this.indices[1],
                    '<a href="' + this.expanded_url + '" target="_blank">'
                        + this.display_url + '</a>');
    });
    return text;
}

/*
 *  Start and Call API
 */
kobatwi = {

    imageUrl: function(url) {
        return 'image/' + url.substring(7);
    },

    getAccount: function(success, error) {
        $.ajax({
            url:      apiAccount,
            dataType: 'json',
            success:  success,
            error:    error
        });
    },
    tweet: function(text, params, success, error) {
        params.status = text;
        $.ajax({
            type:     'POST',
            url:      apiTweet,
            data:     params,
            dataType: 'json',
            success:  success,
            error:    error,
        });
    },
    getTimeline: function(connecter, type, params, success, error) {
        var url = (type == '#home')     ? apiHomeTL
                : (type == '#mention')  ? apiMention
                :                         null;
        
        var callParams = {};
        for (var key in params) {
            callParams[key] = params[key];
        }
        delete callParams.since_id;
        
        $.ajax({
            url:      url,
            data:     callParams,
            dataType: 'json',
            success:  function(timeline){
                timeline = $.grep(timeline, function(n){
                    return      (params.max_id == null
                                || params.max_id
                                        > extId(n.id_str, params.max_id))
                            &&  (params.since_id == null
                                || extId(n.id_str, params.since_id)
                                        >= params.since_id);
                });
                success(connecter, type, params, timeline);
            },
            error:    error        
        });
    },
    
    start: function() {
        init();
        kobatwi.getAccount(showMain, showLogin);
    }    
}

})();

$(function(){kobatwi.start()});
