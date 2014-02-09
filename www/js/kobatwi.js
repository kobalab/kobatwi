/*
 *  Configure jQuery Mobile
 */
$(document).on('mobileinit', function(){
    $.mobile.ajaxEnabled = false;
});


/*
 *  kobatwi
 */
var kobatwi;

(function(){

/*
 *  Utility functions
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
function spliceText(src, from, to, replace) {
    var text = new String(src);
    return text.slice(0, from) + replace + text.slice(to);
}
function insertEntities(text, entities) {
    /*
     *  TODO
     *  textに副作用があるので直した方が良さそう。
     */
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
 *  URL of Twitter API
 */
var apiBaseUrl  = 'proxy/';
var apiAccount  = apiBaseUrl + 'account/verify_credentials.json';
var apiTweet    = apiBaseUrl + 'statuses/update.json';
var apiHomeTl   = apiBaseUrl + 'statuses/home_timeline.json';
var apiMention  = apiBaseUrl + 'statuses/mentions_timeline.json';

/*
 *  Initialize
 */
var template = {};

function getTemplate() {
    template.tweet_form = $('.tweet_form').remove().eq(0);
    template.connecter  = $('.connecter').remove().eq(0);
    template.status     = $('.status').remove().eq(0);
    template.account    = $('.account').remove().eq(0);
}
function setConnecter() {
    $('#home .timeline').append(newConnecter(apiHomeTl, {}).hide());
    $('#mention .timeline').append(newConnecter(apiMention, {}).hide());
}
function setTweetForm() {
    $('#tweet .content .tweet_form').remove();
    $('#tweet .content').append(template.tweet_form.clone());
    $('#tweet .sending, #tweet .error').hide();
}
function setHandler() {

    $(document).on('click', '.connecter', function(event){
        var connecter = $(this);
        connecter.find('.ready, .loading, .error').hide();
        connecter.find('.loading').show();
        kobatwi.getTimeline(connecter,
            setTimeline,
            function(){
                connecter.find('.ready, .loading, .error').hide();
                connecter.find('.error').show();
            }
        );
        return false;
    });

    $('#home').on('click', 'a[href="#home"]', function(){
        $.mobile.silentScroll(0);
    });
    $('#mention').on('click', 'a[href="#mention"]', function(){
        $.mobile.silentScroll(0);
    });

    $(document).on('click', 'a[href="#home"]', function(){
        $('#home .timeline .status').removeClass('new').trigger('update');
        $('#home .timeline .connecter').eq(0).slideDown().click();
    });
    $(document).on('click', 'a[href="#mention"]', function(){
        $('#mention .timeline .status').removeClass('new').trigger('update');
        $('#mention .timeline .connecter').eq(0).slideDown().click();
    });
 
    $(document).on('update', '.status', function(){
        $(this).find('.date').text(dateStr($(this).data('date')));
    });
 
    $('#tweet textarea').on('focus', function(){
        timeId = setInterval(function(){
            var textlen = 140 - $('#tweet textarea').val().length;
            $('#tweet .textlen').text(textlen);
            if (textlen < 0) $('#tweet .textlen').addClass('exceed');
            else             $('#tweet .textlen').removeClass('exceed');
        }, 500);
    });
    $('#tweet').on('click', 'input[type="submit"]', function(){
        var tweet = $('#tweet');
        tweet.find('form').hide();
        tweet.find('.sending').show();
        kobatwi.tweet(
            tweet,
            function(){
                setTweetForm();
                $('#tweet .tweet_form').trigger('create');
                $.mobile.changePage('#home', { transition: 'none' });
                $('#home a[href="#home"]').click();
            },
            function(){
                tweet.find('.sending').hide();
                tweet.find('.error').show();
            }
        );
        return false;
    });
    $('#tweet').on('click', '.error', function(){
        var tweet = $('#tweet');
        tweet.find('.error').hide();
        tweet.find('form').show();
        return false;
    });
}

/*
 *  Loader, Login and Home
 */
function showLoader() {
    $.mobile.changePage('#home', { transition: 'none' });
    $('[data-id="footer"]').hide();
    $('.login').hide();
    $('.loader').show();
    $('.timeline').hide();
}
function showLoginForm() {
    $('.loader').hide();
    $('.login').show();
}
function showHomePage(account) {
    $('.init').remove();
    $('[data-id="footer"]').slideDown();

    $('#account .content').append(newAccount(account));
    $('.timeline').show();
    $('#home .timeline .connecter').eq(0).slideDown().click();
}

/*
 *  Connecter
 */
function newConnecter(url, data) {
    var connecter = template.connecter.clone();

    connecter.data('api', { url: url, data: data });
    connecter.find('.ready, .loading, .error').hide();
    connecter.find('.ready').show();

    return connecter;
}
function setTimeline(connecter, timeline){

    var api = connecter.data('api');

    if (timeline.length > 0
        && timeline[timeline.length - 1].id_str != api.data.since_id)
    {
        var data = {};
        for (var key in api.data) {
            data[key] = api.data[key];
        }
        data.max_id = timeline[timeline.length - 1].id_str;
        connecter.after(newConnecter(api.url, data));
    }
    connecter.after(
        $.map(timeline, function(n){
            if (n.id_str == api.data.since_id) return null;
            return newStatus(n).addClass('new');
        })
    );
    connecter.slideUp('normal', function(){
        if (connecter.data('api').data.max_id == null) {
            if (timeline.length > 0) api.data.since_id = timeline[0].id_str;
            connecter.find('.ready, .loading, .error').hide();
            connecter.find('.ready').show();
        }
        else connecter.remove();
    });
}

/*
 *  Status
 */
function newStatus(data){
    var status = template.status.clone();

    var retweet;
    if (data.retweeted_status == null)
        status.find('.retweet').remove();
    else {
        retweet = data;
        data = data.retweeted_status;
    }

    status.find('img.profile_image')
        .attr('src', kobatwi.imageUrl(data.user.profile_image_url));
    status.find('.name').text(data.user.name);
    status.find('.screen_name').text(data.user.screen_name);
    status.find('.text').html(insertEntities(data.text, data.entities));
    if (data.in_reply_to_status_id_str == null)
        status.find('a[href="#conversation"]').remove();
    status.find('.date').text(dateStr(data.created_at));
    status.data('date', data.created_at);

    if (retweet != null) {
        status.find('.retweet img.profile_image')
            .attr('src', kobatwi.imageUrl(retweet.user.profile_image_url));
        status.find('.retweet .name').text(retweet.user.name);
        status.find('.retweet .screen_name').text(retweet.user.screen_name);
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

    return status;
}

/*
 *  Account
 */
function newAccount(data) {
    var account = template.account.clone();

    account.find('img.profile_image')
        .attr('src', kobatwi.imageUrl(data.profile_image_url));
    account.find('.name').text(data.name);
    account.find('.screen_name').text(data.screen_name);
    account.find('.location').text(data.location);
    account.find('.url').html(insertEntities(data.url, data.entities.url));
    account.find('.description').text(data.description);

    return account;
}

/*
 *  Methods
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

    tweet: function(tweet, success, error) {
        var data = {};
        data.status = tweet.find('textarea').val();
        $.ajax({
            type:     'POST',
            url:      apiTweet,
            data:     data,
            dataType: 'json',
            success:  success,
            error:    error
        });
    },

    getTimeline: function(connecter, success, error) {
 
        var api = connecter.data('api');
 
        var data = {};
        for (var key in api.data) {
            data[key] = api.data[key];
        }
        delete data.since_id;
 
        $.ajax({
            url:      api.url,
            data:     data,
            dataType: 'json',
            success:  function(timeline){
                timeline = $.grep(timeline, function(n){
                    return      (api.data.max_id == null
                                || api.data.max_id.length >  n.id_str.length
                                || api.data.max_id.length == n.id_str.length
                                    && api.data.max_id > n.id_str)
                            &&  (api.data.since_id == null
                                || n.id_str.length >  api.data.since_id.length
                                || n.id_str.length == api.data.since_id.length
                                    && n.id_str >= api.data.since_id);
                });
                success(connecter, timeline);
            },
            error:    error
        });
    },

    start: function() {
        showLoader();
        getTemplate();
        setConnecter();
        setTweetForm();
        setHandler();
 
        kobatwi.getAccount(showHomePage, showLoginForm);
    }
}
})();

$(function(){
    var init = false;
    $(document).on('pageinit', function(){
        if (! init) {
            init = true;
            kobatwi.start();
        }
    });
});
