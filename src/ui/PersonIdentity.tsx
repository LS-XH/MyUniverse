/** Shared identity content for relation cards and roleplay speakers. */
export default function PersonIdentity({name,subtitle,avatar}:{name:string;subtitle:string;avatar?:string}){return <><div className="node-avatar ui-avatar--node ui-surface ui-avatar">{avatar||name.slice(0,1)}</div><div><strong>{name}</strong><span>{subtitle}</span></div></>}
