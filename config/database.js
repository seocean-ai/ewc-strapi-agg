module.exports = ({ env }) => {
	const sslValue = env('DATABASE_SSL', env.ssl) || process.env.DATABASE_SSL;
	const sslConf = sslValue ? JSON.parse(sslValue.replaceAll("'","\"")) : false;
	const cnf = {
		connection: {
			client: (env('DATABASE_CLIENT', 'mysql') || process.env.DATABASE_CLIENT),
			connection: {
				//client: env('DATABASE_CLIENT', 'mysql') || process.env.DATABASE_CLIENT,//|'postgres'),
				host: env('DATABASE_HOST', env.host) || process.env.DATABASE_HOST,
				//domain: env('DATABASE_HOST', env.host) || process.env.DATABASE_HOST,
				//server: env('DATABASE_HOST', env.host) || process.env.DATABASE_HOST,
				port: env.int('DATABASE_PORT', env.port) || process.env.DATABASE_PORT,
				database: env('DATABASE_NAME', env.db) || process.env.DATABASE_NAME,
				user: env('DATABASE_USERNAME', env.user) || process.env.DATABASE_USERNAME,
				password: env('DATABASE_PASSWORD', env.password) || process.env.DATABASE_PASSWORD,
				//schema: env('DATABASE_SCHEMA', 'public'), // For PostgreSQL
				ssl: sslConf,
				/*
				ssl: env.bool('DATABASE_SSL', false) && {
					key: env('DATABASE_SSL_KEY', undefined),
					cert: env('DATABASE_SSL_CERT', undefined),
					ca: env('DATABASE_SSL_CA', undefined),
					capath: env('DATABASE_SSL_CAPATH', undefined),
					cipher: env('DATABASE_SSL_CIPHER', undefined),
					rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', true),
				},
				
				connection: {
					supportBigNumbers: true, // Set to true to enable big number support
					bigNumberStrings: true, // Often used in conjunction with supportBigNumbers
				},
				*/
				//debug: true,
			},
			pool: { 
				min: env.int('DATABASE_POOL_MIN', 2) || process.env.DATABASE_POOL_MIN,
				max: env.int('DATABASE_POOL_MAX', 10) || process.env.DATABASE_POOL_MAX
			},
			debug: false,
			acquireConnectionTimeout: 10000,
			asyncStackTraces: false,
			  log: {
				warn(message) {
				  if (!message.includes('Transaction was implicitly committed')) {
					console.warn(message);
				  }
				},
				error(message) {
				  console.error(message);
				},
				deprecate(message) {},
				debug(message) {},
			  },
		}
	};
	//console.log(cnf);
	return cnf;
};