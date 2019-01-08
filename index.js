'use strict';
require('dotenv').config();

// モジュールの読み込み
const Discord = require('discord.js');
const RichEmbed = Discord.RichEmbed;
const ytdl = require('ytdl-core');

// インスタンスを作成
const Client = new Discord.Client();

// 準備完了時の処理
Client.on('ready', ()=>{
  console.log(`ログイン ${Client.user.tag}`);
});

// エラー処理
Client.on('error', console.error);

// ログイン処理
const token = process.env.DISCORD_BOT_TOKEN;
Client.login(token)
  .catch(console.error);

// TODO 通信が安定しない｡bufferutilとか入れる｡

const queue = new Map();

// メッセージ受信時の処理
Client.on('message', m=>{
  // サーバー以外の発言･bot自身の発言･指定プレフィックスから始まらない発言を無視
  const args = m.content.split(' ');
  const prefix = args.splice(0, 1).join();
  if(!m.guild || m.author.bot || prefix !== process.env.PREFIX) return;

  const command = args.slice(0, 1).join().toLowerCase();
  const guildId = m.guild.id;

  // joinコマンド
  if(command === 'join'){
    const channelId = args[2] ? args[2].replace(/(.*)/g, '$1') : null;
    const channel = (m.guild.channels.get(channelId) || m.member.voiceChannel);
    if(channel && channel.type === 'voice'){
      channel.join().then(connection=>{
        if(!queue.get(guildId)){
          const voiceChannel = channel;
          const textChannel = m.channel;
          queue.set(guildId, {connection, voiceChannel, textChannel, controller: null, audioList: [], volume: 0.5, playing: [0, false]});
        }
        m.channel.send('接続しました');
        controller(guildId);
      });
    }else{
      m.channel.send('ボイスチャンネルを指定してください');
    }
  }

  // leaveコマンド
  else if(command === 'leave'){
    if(queue.get(guildId)){
      controller(guildId, true);
      queue.get(guildId).voiceChannel.leave();
      m.channel.send('切断しました');
    }else{
      m.channel.send('ボイスチャンネルに接続されていません');
    }
  }

  // queueコマンド
  else if(command === 'queue'){
    if(queue.get(guildId)){
      let youtubeVId = null, option = null;
      for(let i=0;i<args.length;i++){
        if(/^http(.*)/.test(args[i])){
          youtubeVId = args[i].replace(/^https?:\/\/(?:www\.)?(?:youtu\.be\/(.{11})|youtube\.com\/watch\?v=(.{11})(?:.*))/, '$1$2');
        }
        if(/^-(.*)/.test(args[i])){
          option = args[i].replace(/(.*)/, '$1');
        }
      }
      if(option === '-i'){
        console.log('最優先');
      }else if(youtubeVId){
        console.log('キューに追加');
        if(queue.get(guildId).audioList.length === 0){
          queue.get(guildId).audioList.push(youtubeVId);
        }else{
          const pos = queue.get(guildId).audioList.indexOf(youtubeVId);
          if(pos !== -1){
            queue.get(guildId).audioList.splice(pos, 1);
          }
          queue.get(guildId).audioList.push(youtubeVId);
        }
        console.log(queue.get(guildId).audioList);
      }else{
        console.log('キューを表示');
      }
    }else{
      m.channel.send('先に`' + process.env.PREFIX + ' join`コマンドでボイスチャンネルに接続させてください');
    }
  }
});

// コントローラー
function controller(guildId, leave = false){
  if(!leave){
    const embed = new RichEmbed()
    .setTitle('コントローラー(現在一部機能使用不可)')
    .setDescription('リアクションで操作してください\n'
    + ':play_pause: 再生/一時停止\n'
    + ':stop_button: 停止\n'
    + ':record_button: 録音\n'
    + ':track_previous: 前のトラック\n'
    + ':track_next: 次のトラック\n'
    + ':speaker: 音量ダウン\n'
    + ':loud_sound: 音量アップ\n'
    + ':mute: ミュート')
      .setColor('GOLD');
      queue.get(guildId).textChannel.send(embed)
      .then(message=>{
        queue.get(guildId).controller = message;
        reactionManager(message)
          .then(()=>{
            Client.on('messageReactionAdd', (messageReaction, user)=>{
              statusManager(messageReaction, user);
            });
            Client.on('messageReactionRemove', (messageReaction, user)=>{
              statusManager(messageReaction, user);
            });
          })
      })
      .catch(console.error);
    }else{
    queue.get(guildId).controller.delete()
      .then(()=>{
        queue.delete(guildId);
      })
      .catch(console.error);
  }
}

// ステータスを制御する関数
function statusManager(messageReaction, user){
  if(messageReaction.me && user.username !== 'U20 Radio Bot' && queue.get(messageReaction.message.channel.guild.id).controller.id === messageReaction._emoji.reaction.message.id){
    const guildId = messageReaction.message.channel.guild.id;
    const reaction = messageReaction._emoji.name;
    switch(reaction){
      case '⏯':
        console.log('再生/一時停止');
        controlPlayStop(guildId);
        break;
      case '⏹':
        console.log('停止');
        break;
      case '⏺':
        console.log('録音');
        break;
      case '⏮':
        console.log('前のトラック');
        break;
      case '⏭':
        console.log('次のトラック');
        break;
      case '🔈':
        console.log('音量ダウン');
        break;
      case '🔊':
        console.log('音量アップ');
        break;
      case '🔇':
        console.log('ミュート');
        break;
      default:
        console.log('未対応の操作');
        break;
    }
  }
}

// リアクションをつける関数
function reactionManager(m){
  return new Promise((resolve, reject)=>{
    m.react('⏯')
      .then(()=>{
        m.react('⏹')
          .then(()=>{
            m.react('⏺')
              .then(()=>{
                m.react('⏮')
                  .then(()=>{
                    m.react('⏭')
                      .then(()=>{
                        m.react('🔈')
                          .then(()=>{
                            m.react('🔊')
                              .then(()=>{
                                m.react('🔇')
                                  .then(resolve);
                              });
                          });
                      });
                  });
              });
          });
      });
  });
}

// 再生/一時停止
function controlPlayStop(guildId){
  // if(!queue.get(guildId).playing[1]){
    const stream = ytdl(`https://www.youtube.com/watch?v=${queue.get(guildId).audioList[queue.get(guildId).playing[0]]}`);
    const dispatcher = queue.get(guildId).connection.playStream(stream)
    dispatcher.setVolumeLogarithmic(queue.get(guildId).volume / 5);
    queue.get(guildId).playing[1] = true;
    queue.get(guildId).textChannel.send('再生中');
  // }else{
  //   queue.get(guildId).connection.dispatcher.pause();
  //   queue.get(guildId).playing[1] = false;
  //   queue.get(guildId).textChannel.send('一時停止');
  // }
}
