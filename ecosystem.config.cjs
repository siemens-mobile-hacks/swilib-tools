module.exports = {
	apps: [
		{
			namespace: "swilib-tools",
			name: "swilib-tools:dev-server",
			script: "dist/src/cli.js",
			args: ["server"],
		},
		{
			namespace: "swilib-tools",
			name: "swilib-tools:update-db",
			script: "dist/src/cli.js",
			args: ["update-db"],
			cron_restart: "* * * * *",
			instances: 1,
			autorestart: false,
		},
	]
};
