import gulp from 'gulp';
import gulpLoadPlugins from 'gulp-load-plugins';
import del from 'del';
import BrowserSync from 'browser-sync';
import {output as pagespeed} from 'psi';
import pkg from './package.json';

const browserSync = BrowserSync.create();
const $ = gulpLoadPlugins();
const productionEnv = $.util.env.env === 'production';
const reload = browserSync.reload;

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
    vendor: 'dist/scripts/vendor',
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
  react: {
    src: {
      root: 'app/react/',
      components: 'app/react/components/*.{js, jsx}',
      containers: 'app/react/containers/*.{js, jsx}',
      server:     'app/react/containers/*.{js, jsx}',
      libs: [
        'node_modules/react/dist/react.js',
        'node_modules/react-dom/dist/react-dom.js'
      ]
    }
  }
};

const config = {
  plumber: {
    errorHandler: handleError
  }
}
/*Utilities*/
// Run PageSpeed Insights
export function runPageSpeedInsights(done){
  console.log(pkg.homepage)
  pagespeed(pkg.homepage, {
      strategy: 'mobile'
      // By default we use the PageSpeed Insights free (no API key) tier.
      // Use a Google Developer API key if you have one: http://goo.gl/RkN0vE
      // key: 'YOUR_API_KEY'
  })
  done()
}
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


// Lint JS/JSX files
export function esLint() {
  return gulp.src(paths.react.src.root + '**/*.{js, jsx}')
    .pipe($.eslint({
      baseConfig: {
        "ecmaFeatures": {
           "jsx": true
         }
      }
    }))
    .pipe($.eslint.format())
    .pipe($.eslint.failAfterError());
}

// Copy react.js and react-dom.js to dist/scripts/vendor
// only if the copy in node_modules is "newer"
//not sure why not pass all to one copy task but let's follow the tutorial
export function copyReactLibs(){
  return gulp.src(paths.react.src.libs)
    .pipe(gulp.dest(paths.scripts.vendor));
}

//Sry hackathon
export function copyAppIndex(){
  return gulp.src(paths.react.src.root + "index.html")
    .pipe(gulp.dest(paths.appRoot.dest));
}

// Concatenate jsFiles.vendor and jsFiles.source into one JS file.
// Run copy-react and eslint before concatenating
export function bundleReact(){
  return gulp.src(paths.react.src.root + "**/*.{js, jsx}")
    .pipe($.sourcemaps.init())
    .pipe($.babel({
      only: [
        //or not
        paths.react.src.components,
      ],
      compact: false
    }))
    .pipe($.concat('reactBundle.js'))
    .pipe($.sourcemaps.write('./'))
    .pipe(gulp.dest(paths.scripts.dest))
    .pipe(browserSync.reload({stream: true}))
}

export function bundleAndExportReact(){
  return gulp.series(
    bundleReact,
    gulp.parallel(
      copyReactLibs,
      copyAppIndex,
      esLint,
    )
  )
}


/*Copy Common App Meta RootFiles */
export function copyRootFiles() {
  return gulp.src([paths.appRoot.src + '/*.*', paths.appRoot.src + '/CNAME'], {since: gulp.lastRun('copyRootFiles'), dot: true})
    .pipe(gulp.dest(paths.appRoot.dest));
}

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
    .pipe($.if(productionEnv, $.size({title: $.util.colors.bgRed('[SIZE] Images: ')})))
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
    .pipe($.plumber(config.plumber))
    .pipe($.if(!productionEnv, $.sourcemaps.init({
      loadMaps: true
    })))
    .pipe($.sass({
      precision: 10,
      sourceComments: !productionEnv,
      outputStyle: productionEnv ? 'compressed' : 'nested'
    }))
    .on('error', handleError('styles'))
    .pipe($.autoprefixer({
      browsers: [
        'last 2 versions',
        'ie >= 10',
        'android >= 4.4'
      ]
    }))
    .pipe($.if(productionEnv,$.cleanCss()))
    .pipe($.rename({
      basename: 'app'
    }))
    .pipe($.if(productionEnv, $.size({title:  $.util.colors.bgRed('[SIZE] Styles: ')})))
    .pipe($.if(!productionEnv, $.sourcemaps.write({
      includeContent: true,
      sourceRoot: '.'
    })))
    .pipe(gulp.dest(paths.styles.dest))
    .pipe(browserSync.reload({stream: true}))
}


/*
 * Non-react scripts
 * 
 * Interactive Script, Animation Scripts
 * This probably make no sense since we can import scripts in the modules
 * I don't know, hackathon!
 */
export function scripts() {
  return gulp.src(paths.scripts.src, { sourcemaps: true })
    .pipe($.cached('scripts'))    
    .pipe($.babel())
    .pipe($.if(productionEnv, $.uglify()))
    .pipe($.remember('scripts'))
    .pipe($.concat('app.js'))
    .pipe($.if(productionEnv, 
      $.size({
        title: $.util.colors.bgRed('[SIZE] Scripts: ')
    })))
    .pipe(gulp.dest(paths.scripts.dest));
}


/*
 * Local server using BrowserSync
 */
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

  browserSync.init(config);
  done()
}



/*
 * Listen for Changes
 */
export function watch() {
  gulp.watch(paths.images.src,  images);
  gulp.watch(paths.fonts.src,   fonts);
  gulp.watch(paths.styles.src,  styles);
  gulp.watch(paths.scripts.src, scripts);
  gulp.watch(paths.react.src.root + '**/*.{js,jsx}', bundleReact);

  $.util.log($.util.colors.bgGreen('Watching for changes...'));
}


/*
 * Build
 *
 * Create a deployable folder
 */
const build = gulp.series(
  clean, 
  gulp.parallel(
    images,
    fonts,
    styles, 
    scripts,
    bundleAndExportReact()
  )
);


/*
 * Serve
 *
 * Serve the deployable folder watch for changes and start a dev server
 */
const serve = gulp.series( 
  build, 
  gulp.parallel(watch, browserSyncServer)
);


/*
 * Deploy To gitHubPages
 *
 * Serve the deployable folder watch for changes and start a dev server
 */

export function githubPages() {
  return gulp.src([paths.appRoot.dest + '**/*.*', paths.appRoot.dest + 'CNAME'])
    .pipe($.ghPages());
}


const deploy = gulp.series(
    build,
    copyRootFiles,
    githubPages
);




/* Export const functions */
export { build, serve, deploy};

/* Default gulp task as serve*/
export default serve;
