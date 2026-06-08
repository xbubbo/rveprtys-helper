const { EmbedBuilder } = require('discord.js');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');
const User = require('../../models/user');
const Portfolio = require('../../models/portfolio');
const Slave = require('../../models/slave');
const Stock = require('../../models/stock');
const Lottery = require('../../models/lottery');
const FishMarket = require('../../models/fishmarket');
const DividendClaim = require('../../models/dividendClaim');
const Will = require('../../models/will');
const { GLOBAL_GUILD_ID } = require('../../utils/economy');

const execFileAsync = promisify(execFile);
const BACKUP_ROOT = path.join(__dirname, '..', '..', '..', 'backups');
const MODELS = [User, Portfolio, Slave, Stock, Lottery, FishMarket, DividendClaim, Will];

async function tryMongodump(outDir) {
    const uri = process.env.MONGO_URI;
    if (!uri) return { ok: false, reason: 'no-uri' };

    try {
        await fs.mkdir(outDir, { recursive: true });
        await execFileAsync('mongodump', ['--uri', uri, '--out', outDir]);
        return { ok: true, method: 'mongodump', dir: outDir };
    } catch (err) {
        if (err.code === 'ENOENT') return { ok: false, reason: 'not-installed' };
        return { ok: false, reason: 'failed', error: err };
    }
}

async function jsonBackup(outDir) {
    await fs.mkdir(outDir, { recursive: true });
    const counts = [];
    for (const Model of MODELS) {
        const name = Model.collection.name;
        const docs = await Model.find({}).lean();
        await fs.writeFile(path.join(outDir, `${name}.json`), JSON.stringify(docs, null, 2), 'utf-8');
        counts.push({ name, count: docs.length });
    }
    return { ok: true, method: 'json', dir: outDir, counts };
}

async function backupDatabase(outDir) {
    const dump = await tryMongodump(outDir);
    if (dump.ok) return dump;

    if (dump.reason === 'failed') {
        throw new Error(
            `\`mongodump\` is installed but failed to run:\n` +
            `\`\`\`${(dump.error.stderr || dump.error.message || '').toString().slice(0, 1200)}\`\`\`\n` +
            `Fix the issue above (or uninstall mongodump so the bot falls back to a JSON backup) before retrying.`
        );
    }

    return jsonBackup(outDir);
}

async function migrateModel(Model) {
    const kept = await Model.countDocuments({ guildId: GLOBAL_GUILD_ID });
    await Model.updateMany({ guildId: GLOBAL_GUILD_ID }, { $unset: { guildId: '' } });
    const { deletedCount } = await Model.deleteMany({ guildId: { $exists: true } });
    return { kept, discarded: deletedCount };
}

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(BACKUP_ROOT, `economy-migration-${stamp}`);

    let backup;
    try {
        backup = await backupDatabase(backupDir);
    } catch (err) {
        return interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle('❌ Migration Aborted - Backup Failed')
                .setDescription(`Nothing was changed - the migration refuses to run without a successful backup.\n\n${err.message}`)
                .setColor(0xFF0000)]
        });
    }

    const results = {};
    results['Users']           = await migrateModel(User);
    results['Portfolios']      = await migrateModel(Portfolio);
    results['Slaves']          = await migrateModel(Slave);
    results['Stocks']          = await migrateModel(Stock);
    results['Lotteries']       = await migrateModel(Lottery);
    results['Fish Markets']    = await migrateModel(FishMarket);
    results['Dividend Claims'] = await migrateModel(DividendClaim);
    results['Wills']           = await migrateModel(Will);

    const lines = Object.entries(results).map(([name, r]) => `**${name}** - kept ${r.kept}, discarded ${r.discarded}`);

    let backupBlurb;
    if (backup.method === 'mongodump') {
        backupBlurb =
            `A full \`mongodump\` backup of the database was saved to:\n` +
            `\`backups/economy-migration-${stamp}/\`\n` +
            `Restore it with \`mongorestore --uri="<MONGO_URI>" "backups/economy-migration-${stamp}"\` if anything looks wrong.`;
    } else {
        const counted = backup.counts.map(c => `**${c.name}** - ${c.count} document${c.count !== 1 ? 's' : ''}`).join('\n');
        backupBlurb =
            `\`mongodump\` wasn't available, so a JSON backup of every collection was saved to:\n` +
            `\`backups/economy-migration-${stamp}/\`\n` +
            counted + '\n' +
            `(Install the MongoDB Database Tools for faster, restorable BSON backups next time - https://www.mongodb.com/try/download/database-tools)`;
    }

    return interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle('🌍 Economy Migration Complete')
            .setDescription(
                `${backupBlurb}\n\n` +
                `The economy is now global - every server shares the same data.\n\n` +
                `Records belonging to guild \`${GLOBAL_GUILD_ID}\` were kept and had their \`guildId\` removed.\n` +
                `All other servers' duplicate records were permanently discarded.\n\n` +
                `**Kept** - the canonical guild's record, now guild-less.\n` +
                `**Discarded** - a duplicate from another server, deleted.\n\n` +
                lines.join('\n')
            )
            .setColor(0x00FF99)
            .setFooter({ text: 'This only needs to run once.' })
            .setTimestamp()]
    });
}

module.exports = { execute };
