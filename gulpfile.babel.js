import gulp from 'gulp';
import gulpLoadPlugins from 'gulp-load-plugins';
import del from 'del';
import panini from 'panini';
import browserSync from 'browser-sync'

const $ = gulpLoadPlugins();
const productionEnv = $.util.env.env === 'production';

const paths = {
  appRoot: {
    src: 'app/',
    dest: 'dist/'
  },
  styles: {
    manifesto: 'app/stylesheets/application.scss',
    src:  'app/stylesheets/**/*.{scss, sass}',
    dest: 'dist/stylesheets'
  },
  scripts: {
    src:  'app/scripts/**/*.{js, coffee}',
    dest: 'dist/scripts/'
  },
  images: {
    src:  'app/assets/images/**/*.{jpg,jpeg,png,gif,webp}',
    dest: 'dist/assets/images/'
  },
  fonts: {
    src:  'app/assets/fonts/**/{*.woff, *.woff2}',
    dest: 'dist/assets/fonts/'
  },
  views: {
    src: 'app/views/',
    dest: 'dist/'
  }
};


export function handleError(task) {
  return function (err) {

    $.notify.onError({
      message: task + ' failed, check the logs..',
      sound: true
    })(err);

    $.util.log($.util.colors.bgRed(task + ' error:'), $.util.colors.red(err));
    this.emit('end');
  };
};

/*
 * For small tasks you can use arrow functions and export
 */
const clean = (done) => del([ paths.appRoot.dest ], done);
export { clean }

// export function clean(done) { 
//  del([ paths.appRoot.dest ])
//  done()
// }


/*
 * Copy & Optimize static assets
 */
export function images() {
  return gulp.src(paths.images.src, {since: gulp.lastRun('images')})
    .pipe($.newer(paths.images.dest))  // pass through newer images only
    .pipe($.imagemin({
      optimizationLevel: 5,
      progressive: true,
      interlaced: true
    }))
    .pipe(gulp.dest(paths.images.dest));
}

/*Copy paste fonts*/
export function fonts() {
  return gulp.src(paths.fonts.src, {since: gulp.lastRun('fonts')})
    .pipe(gulp.dest(paths.fonts.dest));
}


/*
 * STYESHEETS
 */
export function styles() {
  return gulp.src(paths.styles.manifesto)
    .pipe($.plumber())
    .pipe($.sass({
      sourceComments: !productionEnv,
      outputStyle: productionEnv ? 'compressed' : 'nested'
    }))
    .on('error', handleError('styles'))
    .pipe($.autoprefixer({
      browsers: ['last 2 versions'],
    }))
    .pipe($.cleanCss())
    .pipe($.rename({
      basename: 'app'
    }))
    .pipe(gulp.dest(paths.styles.dest))
    .pipe(browserSync.reload({stream: true}))
}

export function scripts() {
  return gulp.src(paths.scripts.src, { sourcemaps: true })
    .pipe($.cached('scripts'))    
    .pipe($.babel())
    .pipe($.if(productionEnv, $.uglify()))
    .pipe($.remember('scripts'))
    .pipe($.concat('app.js'))
    .pipe(gulp.dest(paths.scripts.dest));
}

export function views() {
  return gulp.src(paths.views.src + 'pages/**/*.html' )
    .pipe(panini({
      root: paths.views.src + 'pages/',
      layouts: paths.views.src + 'layouts/',
      partials: paths.views.src + 'partials/',
      helpers: paths.views.src + 'helpers/',
      data: paths.views.src + 'data/'
    }))
    .pipe(
      $.if (productionEnv,
        $.htmlmin({
          removeComments: true,
          collapseWhitespace: true,
          collapseBooleanAttributes: true,
          removeAttributeQuotes: true,
          removeRedundantAttributes: true,
          removeEmptyAttributes: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          removeOptionalTags: true
        })))
    .pipe(gulp.dest(paths.views.dest))

}

export function browserSyncServer(done){
  var config = {
      server: {
        baseDir: paths.appRoot.dest,
      }
  }
  //run TUNNEL=true gulp to start public tunnel url to share.
  if (process.env.TUNNEL === 'true') {
    config.tunnel = "";
  }

  browserSync(config);
  done()
}

export function paniniRefresh(done){
  panini.refresh()
  done()
}

export function paniniRebuild(done) {
  gulp.series(
    paniniRefresh,
    views,
    browserSync.reload,
    done
  );
};


export function watch(done) {
  gulp.watch(paths.images.src,  images);
  gulp.watch(paths.fonts.src,   fonts);
  gulp.watch(paths.styles.src,  styles);
  gulp.watch(paths.scripts.src, scripts);
  gulp.watch(paths.views.src,   views);

  $.util.log($.util.colors.bgGreen('Watching for changes...'));
  done()
}


const build = gulp.series(
  clean, 
  gulp.parallel(
    images,
    fonts,
    styles, 
    scripts,
    views
  )
);

export { build };

const serve = gulp.series( build, gulp.parallel(watch, browserSyncServer));
export { serve };
/*
 * Export a default task
 */
export default build;