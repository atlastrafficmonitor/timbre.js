(function(timbre) {
    "use strict";
    
    function SoundBuffer(_args) {
        timbre.Object.call(this, _args);
        timbre.fn.fixAR(this);
        
        this._.isLooped   = false;
        this._.isReversed = false;
        this._.duration    = 0;
        this._.currentTime = 0;
        this._.currentTimeIncr = this.cell.length * 1000 / timbre.samplerate;
        this._.samplerate  = 44100;
        this._.phase = 0;
        this._.phaseIncr = 0;
    }
    timbre.fn.extend(SoundBuffer, timbre.Object);
    
    var $ = SoundBuffer.prototype;

    var setBuffer = function(value) {
        var _ = this._;
        if (typeof value === "object") {
            var buffer, samplerate;
            if (value instanceof Float32Array) {
                buffer = value;
            } else if (value.buffer instanceof Float32Array) {
                buffer = value.buffer;
                if (typeof value.samplerate === "number") {
                    samplerate = value.samplerate;
                }
            }
            if (buffer) {
                if (samplerate > 0) {
                    _.samplerate = value.samplerate;
                }
                _.buffer = buffer;
                _.phaseIncr = _.samplerate / timbre.samplerate;
                _.duration  = _.buffer.length * 1000 / _.samplerate;
            }
        }
    };
    
    Object.defineProperties($, {
        buffer: {
            set: setBuffer,
            get: function() {
                return this._.buffer;
            }
        },
        isLooped: {
            set: function(value) {
                this._.isLooped = !!value;
            },
            get: function() {
                return this._.isLooped;
            }
        },
        isReversed: {
            set: function(value) {
                var _ = this._;
                _.isReversed = !!value;
                if (_.isReversed) {
                    if (_.phaseIncr > 0) {
                        _.phaseIncr *= -1;
                    }
                    if (_.phase === 0) {
                        _.phase = _.buffer.length + _.phaseIncr;
                    }
                } else {
                    if (_.phaseIncr < 0) {
                        _.phaseIncr *= -1;
                    }
                }
            },
            get: function() {
                return this._.isReversed;
            }
        },
        isEnded: {
            get: function() {
                return this._.isEnded;
            }
        },
        samplerate: {
            get: function() {
                return this._.samplerate;
            }
        },
        duration: {
            get: function() {
                return this._.duration;
            }
        },
        currentTime: {
            set: function(value) {
                if (typeof value === "number") {
                    var _ = this._;
                    if (0 <= value && value <= _.duration) {
                        _.phase = (value / 1000) * _.samplerate;
                        _.currentTime = value;
                    }
                }
            },
            get: function() {
                return this._.currentTime;
            }
        }
    });
    
    $.slice = function(begin, end) {
        var _ = this._;
        var instance = timbre(_.originkey);
        
        var isReversed = _.isReversed;
        if (typeof begin === "number" ){
            begin = (begin * 0.001 * _.samplerate)|0;
        } else {
            begin = 0;
        }
        if (typeof end === "number") {
            end   = (end   * 0.001 * _.samplerate)|0;
        } else {
            end = _.buffer.length;
        }
        if (begin > end) {
            var tmp = begin;
            begin = end;
            end   = tmp;
            isReversed = !isReversed;
        }
        
        instance._.samplerate = _.samplerate;
        if (_.buffer) {
            setBuffer.call(instance, _.buffer.subarray(begin, end));
        }
        instance.isLooped   = this.isLooped;
        instance.isReversed = this.isReversed;
        
        return instance;
    };
    
    $.bang = function() {
        this._.phase   = 0;
        this._.isEnded = false;
        this.emit("bang");
        return this;
    };
    
    $.seq = function(seq_id) {
        var _ = this._;
        var cell = this.cell;
        
        if (this.seq_id !== seq_id) {
            this.seq_id = seq_id;
            
            if (!_.isEnded && _.buffer) {
                var buffer = _.buffer;
                var phase  = _.phase;
                var phaseIncr = _.phaseIncr;
                var mul = _.mul, add = _.add;
                
                for (var i = 0, imax = cell.length; i < imax; ++i) {
                    cell[i] = (buffer[phase|0] || 0) * mul + add;
                    phase += phaseIncr;
                }
                
                if (phase >= buffer.length) {
                    if (_.isLooped) {
                        phase = 0;
                        this.emit("looped");
                    } else {
                        _.isEnded = true;
                        this.emit("ended");
                        timbre.fn.nextTick(clearCell.bind(this));
                    }
                } else if (phase < 0) {
                    if (_.isLooped) {
                        phase = buffer.length + phaseIncr;
                        this.emit("looped");
                    } else {
                        _.isEnded = true;
                        this.emit("ended");
                        timbre.fn.nextTick(clearCell.bind(this));
                    }
                }
                _.phase = phase;
                _.currentTime += _.currentTimeIncr;
            }
        }
        
        return cell;
    };
    
    var clearCell = function() {
        var cell = this.cell;
        for (var i = cell.length; i--; ) {
            cell[i] = 0;
        }
    };
    
    var super_plot = timbre.Object.prototype.plot;
    
    $.plot = function(opts) {
        var _ = this._;
        var buffer = _.buffer;
        if (_.plotFlush) {
            var data = new Float32Array(2048);
            var x = 0, xIncr = buffer.length / 2048;
            for (var i = 0; i < 2048; i++) {
                data[i] = buffer[x|0];
                x += xIncr;
            }
            _.plotData  = data;
            _.plotFlush = null;
        }
        return super_plot.call(this, opts);
    };
    
    timbre.fn.register("buffer", SoundBuffer);
})(timbre);
