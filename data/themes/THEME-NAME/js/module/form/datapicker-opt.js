/*
  UPDATE 2026.07.03
  ver 1.1
  holiday: 2022年以降対応(過去分非対応)
*/
(function ($) {

  $.fn.holiday = function (method) {
    if (methods[method]) {
      return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
    } else if (typeof method === 'object' || !method) {
      return methods.init.apply(this, arguments);
    } else {
      $.error('Method ' + method + ' does not exist on jQuery.holiday');
    }
  };

  const methods = {
    //初期処理
    init: function (options) {
      //datepicker ロードチェック
      if (!$.fn['datepicker']) {
        return this;
      }

      return this.each(function () {
        const $this = $(this);

        if (typeof $this.datepicker != "function") {
          return true; // continue
        }
        //初期化済みチェック
        if ($this.data("holiday")) {
          return true; // continue
        }

        //オプション設定（要素ごとに独立したオブジェクトとして生成）
        const settings = $.extend(true, {}, {
          disableHoliday: {
            // 毎年決まった休み（祝日：振替あり[substitute]）
            '01': [{ 'day': '01', 'name': '元日', 'substitute': 'false' }, { 'day': '02', 'name': '三が日', 'substitute': 'flase' }, { 'day': '03', 'name': '三が日', 'substitute': 'flase' }, { 'day': '2/1', 'name': '成人の日' }],
            '02': [{ 'day': '11', 'name': '建国記念日' }, { 'day': '23', 'name': '天皇誕生日' }],
            '03': [{ 'day': 'spring equinox', 'name': '春分の日' }],
            '04': [{ 'day': '29', 'name': '昭和の日' }],
            '05': [{ 'day': '03', 'name': '憲法記念日' }, { 'day': '04', 'name': 'みどりの日' }, { 'day': '05', 'name': 'こどもの日' }],
            '07': [{ 'day': '3/1', 'name': '海の日', 'not': '2020' }],
            '08': [{ 'day': '11', 'name': '山の日' }],
            '09': [{ 'day': '3/1', 'name': '敬老の日' }, { 'day': 'autumnal equinox', 'name': '秋分の日' }],
            '10': [{ 'day': '2/1', 'name': 'スポーツの日' }],
            '11': [{ 'day': '03', 'name': '文化の日' }, { 'day': '23', 'name': '勤労感謝の日' }],
            '12': []
          },
          disableWeek: [
            // 毎週決まった休み（日曜始まり）
            [null],
            [null],
            [null],
            [null],
            [null],
            [null],
            [null]
          ],
          disableDates: {
            // 年によって変わるもの（振替なし）
            '201509': [{ 'day': '22', 'name': '国民の休日' }],
            '202609': [{ 'day': '22', 'name': '国民の休日' }],
            '203209': [{ 'day': '21', 'name': '国民の休日' }],
            '203709': [{ 'day': '22', 'name': '国民の休日' }]
          },
          //曜日、祝祭日のCSSスタイルクラス（曜日や日付で色をつけたい場合）
          'css': [
            { 'day': 0, 'class': 'day-sunday' },
            { 'day': 1, 'class': 'day-monday' },
            { 'day': 2, 'class': 'day-tuesday' },
            { 'day': 3, 'class': 'day-wednesday' },
            { 'day': 4, 'class': 'day-thursday' },
            { 'day': 5, 'class': 'day-friday' },
            { 'day': 6, 'class': 'day-saturday' },
            { 'day': 'holiday', 'class': 'day-holiday' } //休み登録日
          ]
        }, options);

        //スタイルの登録
        const css = {};
        $.each(settings.css, function (key, val) {
          if (typeof val['class'] != "undefined") {
            css[val['day']] = val['class'];
          }
        });

        // 毎年定期的な休みの調整
        // デフォルト
        const annual = settings.disableHoliday;
        // 追加分
        $.each(settings.addAnnualHoliday, function (key, val) {
          const md = inputFormatMD(val);
          if (annual[md.m]) {
            annual[md.m].push({ 'day': md.d, 'substitute': 'false' });
          } else {
            annual[md.m] = [{ 'day': md.d, 'substitute': 'false' }];
          }
        });
        // 削除分
        $.each(settings.removeAnnualHoliday, function (key, val) {
          const md = inputFormatMD(val);
          if (annual[md.m]) {
            for (let i = 0; i < annual[md.m].length; i++) {
              if (annual[md.m][i]['day'] == md.d) {
                annual[md.m].splice(i, 1);
                i--;
              }
            }
          }
        });
        // 単発休み
        // デフォルト
        const onetime = settings.disableDates;
        // 追加分
        $.each(settings.addOntimeHoliday, function (key, val) {
          const ymd = inputFormatYMD(val);
          if (onetime[ymd.y + ymd.m]) {
            onetime[ymd.y + ymd.m].push({ 'day': ymd.d, 'substitute': 'false' });
          } else {
            onetime[ymd.y + ymd.m] = [{ 'day': ymd.d, 'substitute': 'false' }];
          }
        });
        // 削除分はbeforeShowDay内（prepare内）

        //この要素専用の状態オブジェクト
        const instance = {
          settings: settings,
          css: css,
          annual: annual,
          onetime: onetime,
          holidays: {},
          prepared: {}
        };

        //初期化データ設定（要素ごとに保持）
        $this.data("holiday", instance);

        //祝祭日と日付スタイルの設定（表示する分の日をループでそれぞれの条件に合うのかチェック）
        $this.datepicker("option", "beforeShowDay", function (day) {
          const attr = getAttr(instance, day); //その日の情報取得
          const dow = day.getDay();
          let title = "";
          if (typeof attr['name'] != "undefined") {
            title = attr['name'];
          }
          let style = "";
          const counted_day = countWeek(day);
          //-1を指定した曜日は全部選べない様に
          if (typeof attr['class'] != "undefined") {
            style = attr['class']; //.day-holiday
            return [false, style, title];
          } else if (instance.settings.disableWeek[counted_day.day][0] == -1) {
            return [false, 'ui-state-disabled'];
          } else if (instance.settings.disableWeek[counted_day.day].indexOf(counted_day.count) != -1) {
            return [false, 'ui-state-disabled'];
          } else if (typeof instance.css[dow] != "undefined") {
            style = instance.css[dow]; //.day-***day
          }
          return [true, style, title];
        });
      });

    },

    //終了処理
    destroy: function () {
      return this.each(function () {
        if (typeof $(this).datepicker != "function") {
          return true;
        }
        //祝祭日と日付スタイルの除去
        $(this).datepicker("option", "beforeShowDay", null);
        $(this).removeData("holiday");
      });
    },

    //祝祭日の属性の取得（外部から $(el).holiday('attr', day) として呼ぶ用）
    attr: function (day) {
      const instance = $(this).data("holiday");
      if (!instance) {
        return {};
      }
      return getAttr(instance, day);
    }
  };

  //祝祭日の属性取得（内部共通処理）：要素ごとの instance を明示的に受け取る
  const getAttr = function (instance, day) {
    //日付が文字の場合はDate型に変換する。
    if (typeof day == "string") {
      const match = day.match(/^(20\d{2})(\d{2})(\d{2})$/);
      if (match) {
        match.shift();
        day = new Date(match.join("/"));
      } else {
        day = new Date(day);
      }
    }
    //祝祭日の計算
    const Y = day.getFullYear();
    const M = padzero(day.getMonth() + 1);
    const D = padzero(day.getDate());
    //prepare:その月の休みリストを取得しているかどうか（その日だけでなく、丸ごと取得する）
    if (typeof instance.prepared[Y + M] == "undefined") {
      prepare(instance, Y, M);
    }
    //祝祭日のチェック
    const YMD = Y + M + D;
    if (typeof instance.holidays[YMD] != "undefined") {
      return instance.holidays[YMD];
    } else {
      return {};
    }
  };

  //祝祭日計算
  const prepare = function (instance, Y, M) {
    //作成済みチェック
    if (typeof instance.prepared[Y + M] != "undefined") {
      return true;
    }

    //年間の祝祭日の計算
    const substitutes = {};
    //祝祭日をリストに設定
    if (typeof instance.annual[M] != "undefined") {
      $.each(instance.annual[M], function (key, val) {
        holidaysList(instance, Y, M, val, substitutes);
      });
    }

    // 個別の祝祭日の追加
    // デフォルト
    if (typeof instance.onetime[Y + M] != "undefined") {
      $.each(instance.onetime[Y + M], function (key, val) {
        holidaysList(instance, Y, M, val, substitutes);
      });
    };

    $.each(instance.settings.removeOntimeHoliday, function (key, val) {
      const ymd = inputFormatYMD(val);
      const key2 = ymd.y + ymd.m + ymd.d;
      if (instance.holidays[key2]) {
        delete instance.holidays[key2];
      }
    });

    //振替休日の補正（祝日が続く場合）
    $.each(substitutes, function (key, val) {
      const dt = new Date(key);
      let d = dt.getFullYear() + padzero(dt.getMonth() + 1) + padzero(dt.getDate());
      while (typeof instance.holidays[d] != "undefined") {
        dt.setDate(dt.getDate() + 1);
        d = dt.getFullYear() + padzero(dt.getMonth() + 1) + padzero(dt.getDate());
      }
      instance.holidays[d] = val;
    });

    instance.prepared[Y + M] = true;
    return true;
  }

  const holidaysList = function (instance, Y, M, val, substitutes) {
    let d = null;
    let dayyear;
    // not最優先
    if (val['not']) {
      if (parseInt(val['not']) == Y) {
        return false;
      }
    }
    //祝祭日の日にち
    if (isFinite(val['day'])) {
      //日付固定
      d = val['day'];
    } else if (val['day'] == "spring equinox") {
      //春分の日
      d = parseInt(20.69115 + (Y - 2000) * 0.2421904 - parseInt((Y - 2000) / 4));
    } else if (val['day'] == "autumnal equinox") {
      //秋分の日
      d = parseInt(23.09 + (Y - 2000) * 0.2421904 - parseInt((Y - 2000) / 4));
    } else if (val['day'].match(/\//) && (val.day.match(/\>/) || val.day.match(/\</))) {
      if (val.day.match(/\>/)) {
        //特定年以降
        dayyear = val['day'].split('>');
        if (Y >= dayyear[1]) {
          d = padzero(dayyear[0]);
        }
      } else if (val.day.match(/\</)) {
        //特定年以前
        dayyear = val['day'].split('<');
        if (Y <= dayyear[1]) {
          d = padzero(dayyear[0]);
        }
      }
      if (d) {
        d = padzero(nthday(Y, M, dayyear[0]));
      }
    } else if (val['day'].match(/\//)) {
      //ハッピーマンデー
      d = padzero(nthday(Y, M, val['day']));
    } else if (val.day.match(/\>/)) {
      //特定年以降
      dayyear = val['day'].split('>');
      if (Y >= dayyear[1]) {
        d = padzero(dayyear[0]);
      }
    } else if (val.day.match(/\</)) {
      //特定年以前
      dayyear = val['day'].split('<');
      if (Y <= dayyear[1]) {
        d = padzero(dayyear[0]);
      }
    }

    if (d == null) {
      return true; //continue;
    }

    const attr = {};
    attr['name'] = val['name'];
    if (typeof val['class'] != "undefined") {
      attr['class'] = val['class'];
    } else if (typeof instance.css['holiday'] != "undefined") {
      attr['class'] = instance.css['holiday'];
    } else {
      attr['class'] = "";
    }
    if (typeof val['substitute'] != "undefined") {
      attr['substitute'] = val['substitute'];
    } else {
      attr['substitute'] = 'true';
    }

    instance.holidays[Y + M + d] = attr;

    //振替休日のチェック
    if (instance.holidays[Y + M + d]['substitute'] == 'true') {
      const dt = new Date(Y, M - 1, d);
      if (dt.getDay() == 0) {
        const d2 = padzero(dt.getDate() + 1);
        substitutes[Y + "/" + M + "/" + d2] = {
          'name': words['substitute'] + "(" + val['name'] + ")",
          'class': attr['class']
        };
      }
    }
  }

  //ゼロサプレス
  const padzero = function (val) {
    return ('0' + val).slice(-2);
  }

  //月の第ｎ番目のｍ曜日
  const nthday = function (y, m, val) {
    const dayOfWeek = val.split('/');
    const firstDay = new Date(y, m - 1, 1);
    let adjust = dayOfWeek[1] - firstDay.getDay();
    if (adjust < 0)
      adjust += 7;
    //第ｎ番目のｍ曜日
    return 1 + adjust + (dayOfWeek[0] - 1) * 7;
  }

  // 第ｎ週目
  const countWeek = function (day) {
    return {
      day: day.getDay(),
      count: Math.floor((day.getDate() - 1) / 7) + 1
    };
  }

  //月日フォーマットの解析
  const inputFormatMD = function (val) {
    let m, d;
    if (val.length > 5) {
      if (val.slice(0, 2).match(/\//)) {
        m = padzero(val.slice(0, 1));
        d = val.slice(2);
      } else {
        m = val.slice(0, 2);
        d = val.slice(3);
      }
    } else {
      if (val.slice(0, 2).match(/\//)) {
        m = padzero(val.slice(0, 1));
      } else {
        m = val.slice(0, 2);
      }
      if (val.slice(-2).match(/\//)) {
        d = padzero(val.slice(-1));
      } else {
        d = val.slice(-2);
      }
    }
    return { m: m, d: d };
  }

  //年月日フォーマットの解析
  const inputFormatYMD = function (val) {
    const y = val.slice(0, 4);
    let m, d;
    if (val.slice(6, 7).match(/\//)) {
      m = padzero(val.slice(5, 6));
    } else {
      m = val.slice(5, 7);
    }
    if (val.slice(-2).match(/\//)) {
      d = padzero(val.slice(-1));
    } else {
      d = val.slice(-2);
    }
    return { y: y, m: m, d: d };
  }

  //言語対応
  const words = {
    'substitute': '振替休日'
  };
})(jQuery);