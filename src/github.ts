import jwt_decode, {JwtPayload} from 'jwt-decode';
import * as github from '@actions/github';
import {Context} from '@actions/github/lib/context';
import {components as OctoOpenApiTypes} from '@octokit/openapi-types';
import * as util from './util';

export type ReposGetResponseData = OctoOpenApiTypes['schemas']['repository'];

export function context(): Context {
  return github.context;
}

export async function repo(token: string): Promise<ReposGetResponseData> {
  return github
    .getOctokit(token)
    .rest.repos.get({...github.context.repo})
    .then(response => response.data as ReposGetResponseData);
}

interface Jwt extends JwtPayload {
  ac?: string;
}

export const parseRuntimeToken = (token: string): Jwt => {
  return jwt_decode<Jwt>(token);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromPayload(path: string): any {
  return util.select(github.context.payload, path);
}
